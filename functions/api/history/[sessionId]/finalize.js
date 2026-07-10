import { finalizeSessionSummary, resolveHistoryCustomer, historyResponse } from '../../../_lib/session-history.js';

export async function onRequestPost({ env, request, params }) {
  try {
    if (!env.DB) return historyResponse({ error: 'D1 binding DB is not configured.' }, 503);
    const customerId = await resolveHistoryCustomer(env.DB);
    const body = await request.json().catch(() => ({}));
    const data = await finalizeSessionSummary({
      db: env.DB,
      request,
      customerId,
      sessionId: params.sessionId,
      durationSeconds: body.duration_seconds,
      finalOutcomeHint: body.final_outcome || '',
    });
    return historyResponse({ data });
  } catch (error) {
    return historyResponse({ error: error.message || 'Could not finalize history.' }, 400);
  }
}
