import { listHistory, resolveHistoryCustomer, historyResponse } from '../../_lib/session-history.js';

export async function onRequestGet({ env, request }) {
  try {
    if (!env.DB) return historyResponse({ error: 'D1 binding DB is not configured.' }, 503);
    const customerId = await resolveHistoryCustomer(env.DB);
    const url = new URL(request.url);
    const result = await listHistory({
      db: env.DB,
      customerId,
      limit: url.searchParams.get('limit') || 10,
      cursor: url.searchParams.get('cursor') || '',
      q: url.searchParams.get('q') || '',
      intent: url.searchParams.get('intent') || '',
      outcome: url.searchParams.get('outcome') || '',
      dateFrom: url.searchParams.get('date_from') || '',
      dateTo: url.searchParams.get('date_to') || '',
    });
    return historyResponse(result);
  } catch (error) {
    return historyResponse({ error: error.message || 'Could not search history.' }, 400);
  }
}
