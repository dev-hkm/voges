import { demoCustomerId, json } from '../../_lib/core.js';
export async function onRequestGet({env}) { try { const customerId=await demoCustomerId(env.DB); const data=(await env.DB.prepare('SELECT * FROM audit_logs WHERE customer_id=? ORDER BY timestamp DESC LIMIT 100').bind(customerId).all()).results; return json({data}); } catch(error) { return json({error:error.message},400); } }
