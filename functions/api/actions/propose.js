import { demoCustomerId, json, rateLimit } from '../../_lib/core.js';
import { proposeAction } from '../../_lib/actions.js';
import { storeSessionCard } from '../../_lib/session-history.js';
import { buildPendingActionSummary } from '../../_lib/summary-ui.js';

export async function onRequestPost({ env, request }) {
  try {
    if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);
    const customerId = await demoCustomerId(env.DB);
    await rateLimit(env.DB, customerId, 'propose');
    const body = await request.json();
    const result = await proposeAction({ db: env.DB, request, customerId, body });
    if (result.pending_action) {
      const ui = buildPendingActionSummary(result.pending_action);
      if (result.pending_action.session_id) {
        await storeSessionCard(env.DB, { sessionId: result.pending_action.session_id, customerId, card: ui });
      }
      return json({ ...result, ui });
    }
    return json(result);
  } catch (error) {
    return json({ error: error.message || 'Could not propose action.' }, 400);
  }
}
