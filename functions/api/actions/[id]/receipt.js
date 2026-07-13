import { createActionReceipt } from '../../../_lib/action-receipt.js';
import { demoCustomerId, json } from '../../../_lib/core.js';
import { buildVerifiedActionReceiptSummary } from '../../../_lib/summary-ui.js';

export async function onRequestGet({ env, params }) {
  try {
    const receipt = await createActionReceipt({
      db: env.DB,
      actionId: params.id,
      customerId: await demoCustomerId(env.DB),
    });
    return json({ data: receipt, ui: buildVerifiedActionReceiptSummary(receipt) });
  } catch (error) {
    return json({ error: error.message }, 404);
  }
}
