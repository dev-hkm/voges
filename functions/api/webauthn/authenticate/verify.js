import { json } from '../../../_lib/core.js'; import { verifyAuthentication } from '../../../_lib/webauthn.js';
export async function onRequestPost({env,request}) { try { const body=await request.json(); return json(await verifyAuthentication({db:env.DB,env,request,actionId:body.pending_action_id,response:body.response})); } catch(error) { return json({error:error.message},400); } }
