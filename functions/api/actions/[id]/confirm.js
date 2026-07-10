import { demoCustomerId, json } from '../../../_lib/core.js'; import { confirmAction, mintExecutionToken } from '../../../_lib/actions.js';
// Confirmation is naturally idempotent through the pending-action status. Do not apply a
// customer-wide limiter here: retrying a UI request must not lock a valid pending action.
export async function onRequestPost({env,request,params}) { try { const customerId=await demoCustomerId(env.DB); const action=await confirmAction({db:env.DB,request,customerId,actionId:params.id}); const execution_token=action.requires_biometric ? null : await mintExecutionToken(env.DB,action,env.EXECUTION_TOKEN_SECRET); return json({data:{...action,execution_token}}); } catch(error) { return json({error:error.message},400); } }
