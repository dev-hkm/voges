import { demoCustomerId, json } from '../../../_lib/core.js'; import { cancelAction } from '../../../_lib/actions.js';
export async function onRequestPost({env,request,params}) { try { return json({data:await cancelAction({db:env.DB,request,customerId:await demoCustomerId(env.DB),actionId:params.id})}); } catch(error) { return json({error:error.message},400); } }
