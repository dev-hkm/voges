import { demoCustomerId, json } from '../../_lib/core.js';
export async function onRequestGet({env,params}) { try { const data=await env.DB.prepare('SELECT * FROM audit_logs WHERE id=? AND customer_id=?').bind(params.id,await demoCustomerId(env.DB)).first(); return data ? json({data}) : json({error:'Audit log not found.'},404); } catch(error) { return json({error:error.message},400); } }
