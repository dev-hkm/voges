import { json } from '../../../_lib/core.js'; import { authenticationOptions } from '../../../_lib/webauthn.js';
export async function onRequestPost({env,request}) { try { return json(await authenticationOptions({db:env.DB,env,request,actionId:(await request.json()).pending_action_id})); } catch(error) { return json({error:error.message},400); } }
