import { executeBankingTool } from '../../_lib/banking.js';
import { audit, demoCustomerId, json } from '../../_lib/core.js';
import { storeSessionCard } from '../../_lib/session-history.js';
import { buildSummaryForTool } from '../../_lib/summary-ui.js';

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);
  try {
    const body = await request.json();
    if (!body?.name) return json({ error: 'Tool name is required.' }, 400);
    const customerId = await demoCustomerId(env.DB);
    const data = await executeBankingTool(env.DB, body.name, body.arguments || {}, customerId);
    const summary = buildSummaryForTool(body.name, data);
    await audit(env.DB, request, {
      type: 'tool_read_completed',
      customerId,
      sessionId: body.session_id || null,
      userRequest: body.user_request || null,
      toolName: body.name,
      executionResult: 'completed',
    });
    if (body.session_id) {
      await storeSessionCard(env.DB, { sessionId: body.session_id, customerId, card: summary.ui });
    }
    return json({ data, spoken_response: summary.spoken_response, ui: summary.ui });
  } catch (error) {
    return json({ error: error.message || 'Tool execution failed.' }, 400);
  }
}
