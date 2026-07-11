import { audit, demoCustomerId, json } from '../../_lib/core.js';
import { proposeAction } from '../../_lib/actions.js';
import { buildResolutionPlanSummary } from '../../_lib/summary-ui.js';
import { buildResolutionPlan } from '../../_lib/resolution-engine.js';
import { storeSessionCard } from '../../_lib/session-history.js';

export async function onRequestPost({ env, request }) {
  try {
    if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);
    const body = await request.json();
    const customerId = await demoCustomerId(env.DB);
    const { plan } = await buildResolutionPlan(env.DB, customerId, body || {});
    await audit(env.DB, request, {
      type: 'resolution_plan_generated', customerId, sessionId: body.session_id || null,
      userRequest: body.user_request || null, aiIntent: 'resolution_autopilot',
      policyResult: plan.readiness_check.status, metadata: { plan_id: plan.id, plan_hash: plan.plan_hash, root_causes: plan.root_causes.map((cause) => cause.code) },
    });

    let proposed = null;
    if (plan.steps.some((step) => !step.read_only)) {
      proposed = await proposeAction({
        db: env.DB, request, customerId,
        body: {
          tool_name: 'executeResolutionPlan',
          payload: { plan_id: plan.id, plan_hash: plan.plan_hash, plan },
          user_request: body.user_request || 'Customer requested an automated resolution plan.',
          session_id: body.session_id || null,
          ai_confidence: 1,
        },
      });
    }

    const ui = buildResolutionPlanSummary(plan, proposed?.pending_action || null);
    if (body.session_id) await storeSessionCard(env.DB, { sessionId: body.session_id, customerId, card: ui });
    return json({ plan, pending_action: proposed?.pending_action || null, policy: proposed?.policy || null, ui });
  } catch (error) {
    return json({ error: error.message || 'Could not create a Resolution Plan.' }, 400);
  }
}
