import { json } from '../../../_lib/core.js'; import { verifyRegistration } from '../../../_lib/webauthn.js';
export async function onRequestPost({env,request}) { try { return json(await verifyRegistration({db:env.DB,env,request,response:(await request.json()).response})); } catch(error) { return json({error:error.message},400); } }
