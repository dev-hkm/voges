import { demoCustomerId, json, rateLimit } from '../../../_lib/core.js';
import { executeAction, loadAction } from '../../../_lib/actions.js';
import { createActionReceipt } from '../../../_lib/action-receipt.js';
import { storeSessionCard } from '../../../_lib/session-history.js';
import { buildResolutionCompleteSummary, buildSecurityResultSummary, buildSupportTicketSummary, buildVerifiedActionReceiptSummary } from '../../../_lib/summary-ui.js';

export async function onRequestPost({ env, request, params }) {
  try {
    const customerId = await demoCustomerId(env.DB);
    await rateLimit(env.DB, customerId, `execute:${params.id}`, 3);
    const body = await request.json();
    const action = await loadAction(env.DB, params.id, customerId);
    const data = await executeAction({
      db: env.DB,
      request,
      customerId,
      actionId: params.id,
      executionToken: body.execution_token,
      secret: env.EXECUTION_TOKEN_SECRET,
    });

    const ui = data.resolution_plan
      ? buildResolutionCompleteSummary(data.resolution_plan)
      : data.ticket
      ? buildSupportTicketSummary(data.ticket)
      : buildSecurityResultSummary({ action, result: data, auditReference: params.id });
    const receipt = await createActionReceipt({ db: env.DB, actionId: params.id, customerId });
    const receiptUi = buildVerifiedActionReceiptSummary(receipt);

    if (action.session_id) {
      await Promise.all([
        storeSessionCard(env.DB, { sessionId: action.session_id, customerId, card: ui }),
        storeSessionCard(env.DB, { sessionId: action.session_id, customerId, card: receiptUi }),
      ]);
    }

    return json({ data, ui, receipt, receipt_ui: receiptUi });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}
