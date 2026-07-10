import { demoCustomerId, json } from '../../_lib/core.js'; import { loadAction } from '../../_lib/actions.js';
export async function onRequestGet({env,params}) { try { return json({data:await loadAction(env.DB,params.id,await demoCustomerId(env.DB))}); } catch(error) { return json({error:error.message},404); } }
