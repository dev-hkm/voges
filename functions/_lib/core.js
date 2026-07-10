import { resolveCustomerId } from './banking.js';

export const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const encode = (value) => new TextEncoder().encode(value);
export const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
export const fromB64url = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
export async function sha256(value) { return b64url(await crypto.subtle.digest('SHA-256', encode(value))); }
export async function demoCustomerId(db) { return resolveCustomerId(db); }
export function webauthnConfig(env, request) {
  const origin = env.WEBAUTHN_ORIGIN;
  const rpID = env.WEBAUTHN_RP_ID;
  if (!origin || !rpID) throw new Error('WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be configured.');
  if (new URL(origin).hostname !== rpID) throw new Error('WEBAUTHN_ORIGIN hostname must match WEBAUTHN_RP_ID.');
  return { origin, rpID, rpName: env.WEBAUTHN_RP_NAME || 'Voges' };
}
export async function audit(db, request, event) {
  const requestId = request.headers.get('CF-Ray') || id();
  const source = request.headers.get('CF-Connecting-IP') || 'anonymous';
  await db.prepare(`INSERT INTO audit_logs (id,timestamp,customer_id,session_id,event_type,user_request,ai_intent,tool_name,action_type,policy_result,guardrails_triggered,pending_action_id,confirmation_status,webauthn_credential_id,biometric_verified,execution_result,metadata_json,request_id,ip_hash,user_agent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id(), now(), event.customerId || null, event.sessionId || null, event.type, event.userRequest || null, event.aiIntent || null, event.toolName || null, event.actionType || null, event.policyResult || null, event.guardrails || null, event.pendingActionId || null, event.confirmationStatus || null, event.credentialId || null, event.biometricVerified ? 1 : 0, event.executionResult || null, JSON.stringify(event.metadata || {}), requestId, await sha256(source), request.headers.get('User-Agent') || null, now()).run();
}
export async function rateLimit(db, customerId, endpoint, max = 10) {
  const start = new Date(Date.now() - 60_000).toISOString();
  const old = await db.prepare('SELECT window_start,count FROM action_rate_limits WHERE customer_id=? AND endpoint=?').bind(customerId, endpoint).first();
  if (!old || old.window_start < start) { await db.prepare('INSERT OR REPLACE INTO action_rate_limits (customer_id,endpoint,window_start,count) VALUES (?,?,?,1)').bind(customerId, endpoint, now()).run(); return; }
  if (old.count >= max) throw new Error('Too many security-sensitive requests. Please wait a minute.');
  await db.prepare('UPDATE action_rate_limits SET count=count+1 WHERE customer_id=? AND endpoint=?').bind(customerId, endpoint).run();
}
