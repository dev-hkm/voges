import { audit, demoCustomerId, id, json, now } from './core.js';
import { validateHistorySummary, validateSummaryCard } from '../../shared/ui-contracts.js';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferPrimaryIntent(tools, actions, cards) {
  if (actions.some((item) => item.status === 'completed' && item.tool_name === 'enableOnlinePayments')) return 'enable_online_payments';
  if (tools.includes('explainDeclineReason') || cards.some((card) => card.type === 'decline_reason')) return 'explain_card_decline';
  if (tools.includes('getRecentTransactions')) return 'recent_transactions_review';
  if (tools.includes('getKycStatus')) return 'kyc_status_check';
  if (tools.includes('getCardStatus')) return 'card_status_review';
  return 'general_banking';
}

function inferTitle(intent, cards, actions) {
  const names = {
    recent_transactions_review: 'Recent transactions review',
    explain_card_decline: 'Payment declined review',
    kyc_status_check: 'KYC status check',
    card_status_review: 'Card status review',
    enable_online_payments: 'Online payments enabled',
    general_banking: 'Voice banking session',
  };
  if (actions.length) {
    const action = actions.find((item) => item.status === 'completed') || actions[0];
    if (action?.display_title) return action.display_title;
  }
  if (cards.length) return cards[0].title;
  return names[intent] || 'Voice banking session';
}

function inferOutcome(actions, cards) {
  const completed = actions.find((item) => item.status === 'completed');
  if (completed?.result_json) {
    const result = parseJson(completed.result_json, {});
    if (result?.action === 'enableOnlinePayments') return 'Online payments were enabled successfully.';
    if (result?.action === 'disableOnlinePayments') return 'Online payments were disabled successfully.';
    if (result?.action === 'freezeCard') return 'The card was frozen successfully.';
    if (result?.action === 'unfreezeCard') return 'The card was unfrozen successfully.';
  }
  const latestCard = cards[0];
  if (latestCard?.type === 'transaction_summary') return 'Recent transactions were reviewed.';
  if (latestCard?.type === 'decline_reason') return 'The decline reason was explained.';
  return 'Session completed successfully.';
}

function buildSummaryText(intent, actions, tools, cards) {
  const toolLine = tools.length ? `Tools used: ${tools.join(', ')}.` : 'No banking tools were required.';
  const actionLine = actions.length
    ? `Actions proposed: ${actions.length}, completed: ${actions.filter((item) => item.status === 'completed').length}.`
    : 'No customer action was proposed.';
  const cardLine = cards.length ? `Screen summaries shown: ${cards.length}.` : 'No visual summary card was shown.';
  const intentLine = {
    recent_transactions_review: 'The customer asked to review recent transactions.',
    explain_card_decline: 'The customer asked why a payment was declined.',
    kyc_status_check: 'The customer asked about KYC status.',
    card_status_review: 'The customer asked about card controls and limits.',
    enable_online_payments: 'The customer completed a card control update.',
    general_banking: 'The customer had a general banking conversation.',
  }[intent] || 'The customer had a banking conversation.';
  return `${intentLine} ${toolLine} ${actionLine} ${cardLine}`.trim();
}

export async function createVoiceSession(db, request, customerId) {
  const sessionId = id();
  const startedAt = now();
  const device = request.headers.get('User-Agent') || 'unknown';
  const language = request.headers.get('Accept-Language')?.split(',')[0] || 'en-US';
  await db.prepare(
    'INSERT INTO voice_sessions (id, customer_id, started_at, device, language) VALUES (?, ?, ?, ?, ?)',
  ).bind(sessionId, customerId, startedAt, device, language).run();
  return { session_id: sessionId, customer_id: customerId, started_at: startedAt };
}

export async function storeSessionCard(db, { sessionId, customerId, card }) {
  if (!sessionId || !customerId || !card) return;
  const safeCard = validateSummaryCard(card);
  const row = {
    id: id(),
    session_id: sessionId,
    customer_id: customerId,
    card_type: safeCard.type,
    title: safeCard.title,
    subtitle: safeCard.subtitle || '',
    payload_json: JSON.stringify(safeCard),
    created_at: now(),
    updated_at: now(),
  };
  await db.prepare(
    'INSERT INTO session_visual_cards (id, session_id, customer_id, card_type, title, subtitle, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    row.id,
    row.session_id,
    row.customer_id,
    row.card_type,
    row.title,
    row.subtitle,
    row.payload_json,
    row.created_at,
    row.updated_at,
  ).run();
}

export async function finalizeSessionSummary({ db, request, customerId, sessionId, durationSeconds, finalOutcomeHint = '' }) {
  const session = await db.prepare(
    'SELECT id, customer_id, started_at, ended_at, duration_seconds FROM voice_sessions WHERE id = ? AND customer_id = ?',
  ).bind(sessionId, customerId).first();

  if (!session) throw new Error('Voice session was not found.');

  const endedAt = now();
  const duration = Math.max(0, Number(durationSeconds || session.duration_seconds || Math.round((Date.now() - Date.parse(session.started_at)) / 1000)));

  await db.prepare(
    'UPDATE voice_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ? AND customer_id = ?',
  ).bind(endedAt, duration, sessionId, customerId).run();

  const [auditRows, actionRows, cardRows] = await Promise.all([
    db.prepare('SELECT event_type, tool_name, biometric_verified, execution_result, timestamp FROM audit_logs WHERE customer_id = ? AND session_id = ? ORDER BY timestamp DESC LIMIT 100')
      .bind(customerId, sessionId).all(),
    db.prepare('SELECT id, tool_name, display_title, status, result_json, requires_biometric, created_at FROM pending_actions WHERE customer_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 20')
      .bind(customerId, sessionId).all(),
    db.prepare('SELECT payload_json, created_at FROM session_visual_cards WHERE customer_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 20')
      .bind(customerId, sessionId).all(),
  ]);

  const actions = actionRows.results || [];
  const cards = (cardRows.results || []).map((row) => validateSummaryCard(parseJson(row.payload_json, {})));
  const tools = unique((auditRows.results || []).map((row) => row.tool_name));
  const biometricVerified = (auditRows.results || []).some((row) => Boolean(row.biometric_verified)) || actions.some((row) => Boolean(row.requires_biometric));
  const primaryIntent = inferPrimaryIntent(tools, actions, cards);
  const title = inferTitle(primaryIntent, cards, actions);
  const finalOutcome = finalOutcomeHint || inferOutcome(actions, cards);
  const securityResult = biometricVerified ? 'Device verified during this session.' : 'No device verification was required.';
  const summary = buildSummaryText(primaryIntent, actions, tools, cards);

  const record = validateHistorySummary({
    session_id: sessionId,
    customer_id: customerId,
    title,
    started_at: session.started_at,
    ended_at: endedAt,
    duration_seconds: duration,
    primary_intent: primaryIntent,
    summary,
    tools_called: tools,
    visual_cards: cards,
    actions_proposed: actions.length,
    actions_completed: actions.filter((row) => row.status === 'completed').length,
    actions_blocked: actions.filter((row) => ['blocked', 'failed', 'cancelled', 'expired'].includes(row.status)).length,
    biometric_verified: biometricVerified,
    security_result: securityResult,
    final_outcome: finalOutcome,
    created_at: session.started_at,
    updated_at: endedAt,
  });

  const summaryRow = {
    id: id(),
    session_id: record.session_id,
    customer_id: record.customer_id,
    title: record.title,
    started_at: record.started_at,
    ended_at: record.ended_at,
    duration_seconds: record.duration_seconds,
    primary_intent: record.primary_intent,
    summary: record.summary,
    tools_called_json: JSON.stringify(record.tools_called),
    visual_cards_json: JSON.stringify(record.visual_cards),
    actions_json: JSON.stringify(actions.map((row) => ({
      id: row.id,
      tool_name: row.tool_name,
      display_title: row.display_title,
      status: row.status,
      requires_biometric: Boolean(row.requires_biometric),
      created_at: row.created_at,
    }))),
    final_outcome: record.final_outcome,
    biometric_verified: record.biometric_verified ? 1 : 0,
    security_result: record.security_result,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };

  await db.prepare(
    `INSERT INTO session_summaries
      (id, session_id, customer_id, title, started_at, ended_at, duration_seconds, primary_intent, summary, tools_called_json, visual_cards_json, actions_json, final_outcome, biometric_verified, security_result, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        title = excluded.title,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        duration_seconds = excluded.duration_seconds,
        primary_intent = excluded.primary_intent,
        summary = excluded.summary,
        tools_called_json = excluded.tools_called_json,
        visual_cards_json = excluded.visual_cards_json,
        actions_json = excluded.actions_json,
        final_outcome = excluded.final_outcome,
        biometric_verified = excluded.biometric_verified,
        security_result = excluded.security_result,
        updated_at = excluded.updated_at`,
  ).bind(
    summaryRow.id,
    summaryRow.session_id,
    summaryRow.customer_id,
    summaryRow.title,
    summaryRow.started_at,
    summaryRow.ended_at,
    summaryRow.duration_seconds,
    summaryRow.primary_intent,
    summaryRow.summary,
    summaryRow.tools_called_json,
    summaryRow.visual_cards_json,
    summaryRow.actions_json,
    summaryRow.final_outcome,
    summaryRow.biometric_verified,
    summaryRow.security_result,
    summaryRow.created_at,
    summaryRow.updated_at,
  ).run();

  await audit(db, request, {
    type: 'session_finalized',
    customerId,
    sessionId,
    executionResult: 'completed',
    metadata: { title, primaryIntent, finalOutcome },
  });

  return record;
}

export async function listHistory({ db, customerId, limit = 10, cursor, q, intent, outcome, dateFrom, dateTo }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const clauses = ['customer_id = ?', 'deleted_from_history = 0'];
  const bindings = [customerId];

  if (cursor) {
    clauses.push('updated_at < ?');
    bindings.push(cursor);
  }
  if (q) {
    clauses.push('(lower(title) LIKE lower(?) OR lower(summary) LIKE lower(?) OR lower(final_outcome) LIKE lower(?))');
    bindings.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (intent) {
    clauses.push('primary_intent = ?');
    bindings.push(intent);
  }
  if (outcome) {
    clauses.push('lower(final_outcome) LIKE lower(?)');
    bindings.push(`%${outcome}%`);
  }
  if (dateFrom) {
    clauses.push('created_at >= ?');
    bindings.push(dateFrom);
  }
  if (dateTo) {
    clauses.push('created_at <= ?');
    bindings.push(dateTo);
  }

  const sql = `SELECT * FROM session_summaries WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`;
  const result = await db.prepare(sql).bind(...bindings, safeLimit + 1).all();
  const rows = result.results || [];
  const hasMore = rows.length > safeLimit;
  const items = rows.slice(0, safeLimit).map((row) => ({
    session_id: row.session_id,
    title: row.title,
    primary_intent: row.primary_intent,
    summary: row.summary,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: Number(row.duration_seconds || 0),
    final_outcome: row.final_outcome,
    biometric_verified: Boolean(row.biometric_verified),
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
    tools_called: parseJson(row.tools_called_json, []),
    visual_cards: parseJson(row.visual_cards_json, []),
    actions: parseJson(row.actions_json, []),
  }));

  return {
    data: items,
    meta: {
      next_cursor: hasMore ? items[items.length - 1]?.updated_at || null : null,
      has_more: hasMore,
    },
  };
}

export async function getHistoryDetail({ db, customerId, sessionId }) {
  const summary = await db.prepare('SELECT * FROM session_summaries WHERE session_id = ? AND customer_id = ? AND deleted_from_history = 0')
    .bind(sessionId, customerId)
    .first();
  if (!summary) throw new Error('History session not found.');

  const [cards, auditRows] = await Promise.all([
    db.prepare('SELECT payload_json, created_at FROM session_visual_cards WHERE session_id = ? AND customer_id = ? ORDER BY created_at DESC')
      .bind(sessionId, customerId).all(),
    db.prepare('SELECT id, timestamp, event_type, tool_name, execution_result, biometric_verified, pending_action_id FROM audit_logs WHERE session_id = ? AND customer_id = ? ORDER BY timestamp DESC LIMIT 50')
      .bind(sessionId, customerId).all(),
  ]);

  return {
    data: {
      ...summary,
      tools_called: parseJson(summary.tools_called_json, []),
      visual_cards: (cards.results || []).map((row) => validateSummaryCard(parseJson(row.payload_json, {}))),
      actions: parseJson(summary.actions_json, []),
      audit: auditRows.results || [],
    },
  };
}

export async function archiveHistory({ db, request, customerId, sessionId }) {
  const updatedAt = now();
  const result = await db.prepare(
    'UPDATE session_summaries SET archived_at = ?, deleted_from_history = 1, updated_at = ? WHERE session_id = ? AND customer_id = ?',
  ).bind(updatedAt, updatedAt, sessionId, customerId).run();

  if (!result.meta?.changes) throw new Error('History session not found.');

  await audit(db, request, {
    type: 'history_archived',
    customerId,
    sessionId,
    executionResult: 'archived',
  });

  return { archived: true, archived_at: updatedAt, session_id: sessionId };
}

export async function resolveHistoryCustomer(db) {
  return demoCustomerId(db);
}

export function historyResponse(body, status = 200) {
  return json(body, status);
}
