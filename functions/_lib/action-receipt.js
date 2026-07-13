import { sha256 } from './core.js';

const STATE_FIELDS = {
  status: 'Card status',
  online_payment_enabled: 'Online payments',
  international_payment_enabled: 'International payments',
  daily_limit: 'Daily limit',
  monthly_limit: 'Monthly limit',
};

function parse(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function displayValue(field, value) {
  if (field.endsWith('_enabled')) return Number(value) === 1 ? 'Enabled' : 'Disabled';
  if (field.endsWith('_limit')) return Number(value || 0);
  return String(value ?? 'Not available');
}

function stateChanges(result = {}) {
  const before = result.before || {};
  const after = result.after || {};
  return Object.entries(STATE_FIELDS)
    .filter(([field]) => Object.hasOwn(before, field) && Object.hasOwn(after, field) && before[field] !== after[field])
    .map(([field, label]) => ({
      field,
      label,
      before: displayValue(field, before[field]),
      after: displayValue(field, after[field]),
    }));
}

function domainOutcome(result = {}) {
  if (result.ticket) return `Support ticket ${result.ticket.id} created with status ${result.ticket.status}.`;
  if (result.resolution_plan) {
    const readiness = result.resolution_plan.readiness_check?.status || 'unknown';
    return `Resolution Plan completed with readiness status ${readiness}.`;
  }
  const changes = stateChanges(result);
  if (changes.length) return changes.map((item) => `${item.label}: ${item.after}`).join('; ');
  return `${result.action || 'Approved action'} completed.`;
}

export function buildActionReceiptPayload({ action, result, audits = [] }) {
  const policy = parse(action.policy_decision_json);
  const eventTypes = [...new Set(audits.map((item) => item.event_type).filter(Boolean))];
  const biometricVerified = Boolean(action.biometric_verified_at)
    || audits.some((item) => Number(item.biometric_verified) === 1);

  return {
    version: 1,
    receipt_id: `receipt_${action.id}`,
    action_id: action.id,
    issued_at: action.executed_at || action.created_at,
    status: action.status,
    title: action.display_title,
    tool_name: action.tool_name,
    affected_resource: action.affected_resource || 'Selected banking resource',
    risk_level: action.risk_level,
    policy: {
      decision: policy.decision || 'unknown',
      reason: policy.reason || 'Evaluated by backend policy.',
      matched_rules: Array.isArray(policy.matchedRules) ? policy.matchedRules : [],
    },
    verification: {
      required: Boolean(action.requires_biometric),
      method: action.requires_biometric ? 'WebAuthn passkey' : 'On-screen confirmation',
      verified: action.requires_biometric ? biometricVerified : Boolean(action.confirmed_at),
      verified_at: action.biometric_verified_at || action.confirmed_at || null,
    },
    persistence: {
      database: 'Cloudflare D1',
      committed: action.status === 'completed',
      state_changes: stateChanges(result),
    },
    outcome: domainOutcome(result),
    audit: {
      event_count: audits.length,
      events: eventTypes,
    },
  };
}

export async function createActionReceipt({ db, actionId, customerId }) {
  const action = await db.prepare('SELECT * FROM pending_actions WHERE id=? AND customer_id=?').bind(actionId, customerId).first();
  if (!action || action.status !== 'completed') throw new Error('A completed action is required to create a verified receipt.');
  const auditRows = await db.prepare('SELECT event_type,biometric_verified,execution_result,timestamp FROM audit_logs WHERE pending_action_id=? AND customer_id=? ORDER BY timestamp ASC').bind(actionId, customerId).all();
  const payload = buildActionReceiptPayload({
    action,
    result: parse(action.result_json),
    audits: auditRows.results || [],
  });
  return { ...payload, integrity_hash: await sha256(JSON.stringify(payload)) };
}
