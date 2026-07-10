import { getHistoryDetail, resolveHistoryCustomer, historyResponse } from '../../../_lib/session-history.js';

export async function onRequestGet({ env, params }) {
  try {
    if (!env.DB) return historyResponse({ error: 'D1 binding DB is not configured.' }, 503);
    const customerId = await resolveHistoryCustomer(env.DB);
    const detail = await getHistoryDetail({ db: env.DB, customerId, sessionId: params.sessionId });
    return historyResponse({ data: detail.data.visual_cards || [] });
  } catch (error) {
    return historyResponse({ error: error.message || 'Could not load session cards.' }, 404);
  }
}
