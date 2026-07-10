import { demoCustomerId, json } from '../../_lib/core.js'; import { evaluatePolicy, ACTION_METADATA } from '../../_lib/policy.js';
export async function onRequestPost({env,request}) { try { const body=await request.json(); const customerId=await demoCustomerId(env.DB); return json({data:await evaluatePolicy({db:env.DB,customerId,toolName:body.tool_name,payload:body.payload,userRequest:body.user_request,aiConfidence:body.ai_confidence})}); } catch(error) { return json({error:error.message},400); } }
export async function onRequestGet() { return json({data:ACTION_METADATA}); }
