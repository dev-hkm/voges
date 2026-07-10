import { json } from '../../../_lib/core.js'; import { registrationOptions } from '../../../_lib/webauthn.js';
export async function onRequestPost({env,request}) { try { return json(await registrationOptions({db:env.DB,env,request})); } catch(error) { return json({error:error.message},400); } }
