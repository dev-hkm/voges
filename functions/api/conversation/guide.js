import { audit, demoCustomerId, json } from '../../_lib/core.js';
import { getCustomerContext } from '../../_lib/banking.js';
import { buildConversationGuidance } from '../../_lib/goal-manager.js';

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const customerId = await demoCustomerId(env.DB);
    const customerContext = await getCustomerContext(env.DB, customerId);
    const guidance = buildConversationGuidance({
      userRequest: body.user_request,
      priorContext: Array.isArray(body.prior_context) ? body.prior_context.slice(-6) : [],
      customerContext,
    });
    await audit(env.DB, request, {
      type: 'goal_manager_evaluated', customerId, sessionId: body.session_id || null,
      userRequest: body.user_request || null, aiIntent: guidance.customer_goal,
      executionResult: guidance.completion_status, metadata: guidance,
    });
    return json({ data: guidance });
  } catch (error) {
    return json({ error: error.message || 'Could not evaluate conversation guidance.' }, 400);
  }
}
