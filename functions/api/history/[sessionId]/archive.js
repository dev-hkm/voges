import { archiveHistory, resolveHistoryCustomer, historyResponse } from '../../../_lib/session-history.js';

export async function onRequestPost({ env, request, params }) {
  try {
    if (!env.DB) return historyResponse({ error: 'D1 binding DB is not configured.' }, 503);
    const customerId = await resolveHistoryCustomer(env.DB);
    const data = await archiveHistory({
      db: env.DB,
      request,
      customerId,
      sessionId: params.sessionId,
    });
    return historyResponse({ data });
  } catch (error) {
    return historyResponse({ error: error.message || 'Could not archive history.' }, 400);
  }
}
