import { audit, id, now, sha256 } from './core.js';
import { evaluatePolicy } from './policy.js';
import { buildResolutionPlan, verifyResolutionPlan } from './resolution-engine.js';

function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function expiry(seconds) { return new Date(Date.now() + seconds * 1000).toISOString(); }
function display(tool, payload, card) {
  const names = { enableOnlinePayments:'Enable online payments',disableOnlinePayments:'Disable online payments',enableInternationalPayments:'Enable international payments',disableInternationalPayments:'Disable international payments',toggleSavingsFeature:'Update savings feature',freezeCard:'Freeze card',unfreezeCard:'Unlock card',replaceCard:'Request card replacement',createSupportTicket:'Create support ticket',generateFundingInstructions:'Generate funding instructions',escalateToHuman:'Escalate to human support',updateCardDailyLimit:'Increase daily card limit',executeResolutionPlan:'Approve Resolution Plan' };
  const resource = card?.card_number_masked ? `Card ${card.card_number_masked}` : null;
  return { title: names[tool] || tool, description: resource ? `${names[tool]} for ${resource}.` : `${names[tool]}.`, resource };
}
export async function proposeAction({ db, request, customerId, body }) {
  const policy = await evaluatePolicy({ db, customerId, toolName: body.tool_name, payload: body.payload || {}, userRequest: body.user_request || '', aiConfidence: Number(body.ai_confidence ?? 1) });
  await audit(db, request, { type:'policy_evaluated', customerId, sessionId:body.session_id || null, userRequest:body.user_request, toolName:body.tool_name, policyResult:policy.decision, guardrails:policy.matchedRules.join(',') });
  if (policy.decision === 'block' || policy.decision === 'escalate') { await audit(db, request, { type:policy.decision === 'block' ? 'policy_blocked' : 'human_escalation_created', customerId, sessionId:body.session_id || null, toolName:body.tool_name, policyResult:policy.decision, guardrails:policy.matchedRules.join(',') }); return { blocked:true, policy }; }
  // Realtime may repeat one identical function call while finishing a response.
  // Reuse the current approval contract rather than making several Verify sheets.
  const payloadJson = JSON.stringify(body.payload || {});
  const existing = await db.prepare("SELECT * FROM pending_actions WHERE customer_id=? AND tool_name=? AND payload_json=? AND status IN ('awaiting_confirmation','awaiting_biometric','verified') AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(customerId, body.tool_name, payloadJson, now()).first();
  if (existing) {
    const existingPolicy = parse(existing.policy_decision_json);
    return { pending_action: { ...existing, payload: body.payload || {}, policy: existingPolicy }, policy: existingPolicy };
  }
  const view = display(body.tool_name, body.payload || {}, policy.card);
  const action = { id:id(), customer_id:customerId, session_id:body.session_id || null, action_type:body.tool_name, tool_name:body.tool_name, payload_json:payloadJson, display_title:view.title, display_description:view.description, affected_resource:view.resource, risk_level:policy.riskLevel, requires_confirmation:policy.requiresConfirmation ? 1 : 0, requires_biometric:policy.requiresBiometric ? 1 : 0, policy_decision_json:JSON.stringify(policy), status:'awaiting_confirmation', expires_at:expiry(policy.expiresInSeconds), created_at:now() };
  await db.prepare(`INSERT INTO pending_actions (id,customer_id,session_id,action_type,tool_name,payload_json,display_title,display_description,affected_resource,risk_level,requires_confirmation,requires_biometric,policy_decision_json,status,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...Object.values(action)).run();
  await audit(db, request, { type:'action_proposed', customerId, sessionId:action.session_id || null, userRequest:body.user_request, toolName:body.tool_name, actionType:body.tool_name, policyResult:policy.decision, pendingActionId:action.id });
  return { pending_action: { ...action, payload:body.payload || {}, policy }, policy };
}
export async function loadAction(db, actionId, customerId) { const action=await db.prepare('SELECT * FROM pending_actions WHERE id=? AND customer_id=?').bind(actionId, customerId).first(); if (!action) throw new Error('Pending action not found.'); if (action.expires_at <= now() && !['completed','cancelled','failed','blocked'].includes(action.status)) { await db.prepare("UPDATE pending_actions SET status='expired' WHERE id=?").bind(action.id).run(); action.status='expired'; } return action; }
export async function confirmAction({ db, request, customerId, actionId }) {
  const action = await loadAction(db, actionId, customerId);
  if (action.status !== 'awaiting_confirmation') throw new Error(`This action is ${action.status}.`);
  const next = action.requires_biometric ? 'awaiting_biometric' : 'verified';
  await db.prepare("UPDATE pending_actions SET status=?,confirmed_at=? WHERE id=? AND status='awaiting_confirmation'")
    .bind(next, now(), action.id).run();
  await audit(db, request, {
    type: 'confirmation_shown',
    customerId,
    sessionId: action.session_id || null,
    toolName: action.tool_name,
    pendingActionId: action.id,
    confirmationStatus: 'confirmed',
  });
  return loadAction(db, actionId, customerId);
}
export async function cancelAction({ db, request, customerId, actionId }) { const action=await loadAction(db,actionId,customerId); if (!['awaiting_confirmation','awaiting_biometric','verified'].includes(action.status)) throw new Error(`This action cannot be cancelled because it is ${action.status}.`); await db.prepare("UPDATE pending_actions SET status='cancelled',cancelled_at=? WHERE id=? AND status IN ('awaiting_confirmation','awaiting_biometric','verified')").bind(now(),action.id).run(); await audit(db,request,{type:'confirmation_cancelled',customerId,sessionId:action.session_id || null,toolName:action.tool_name,pendingActionId:action.id,confirmationStatus:'cancelled'}); return loadAction(db,actionId,customerId); }
export async function mintExecutionToken(db, action, secret) { if (!secret) throw new Error('EXECUTION_TOKEN_SECRET is not configured.'); const raw=`${action.id}.${crypto.randomUUID()}`; await db.prepare('UPDATE pending_actions SET execution_token_hash=?,execution_token_expires_at=? WHERE id=?').bind(await sha256(`${raw}.${secret}`),expiry(120),action.id).run(); return raw; }
export async function executeAction({ db, request, customerId, actionId, executionToken, secret }) {
  const action=await loadAction(db,actionId,customerId); if (action.status !== 'verified') throw new Error('The action has not completed its required approval and verification.'); if (!executionToken || !action.execution_token_hash || action.execution_token_expires_at <= now() || action.execution_token_hash !== await sha256(`${executionToken}.${secret}`)) throw new Error('Execution token is invalid or expired.');
  const biometricVerified = Boolean(action.requires_biometric && action.biometric_verified_at);
  const policy=await evaluatePolicy({db,customerId,toolName:action.tool_name,payload:parse(action.payload_json),userRequest:''}); if (policy.decision === 'block' || policy.decision === 'escalate') throw new Error('Policy changed and no longer permits this action.');
  const locked=await db.prepare("UPDATE pending_actions SET status='executing' WHERE id=? AND customer_id=? AND status='verified' AND expires_at>? ").bind(action.id,customerId,now()).run(); if (!locked.meta?.changes) throw new Error('This action was already executed or expired.');
  await audit(db,request,{type:'action_execution_started',customerId,sessionId:action.session_id || null,toolName:action.tool_name,pendingActionId:action.id,biometricVerified});
  try { const result=await apply(db,action,customerId,request); await db.prepare("UPDATE pending_actions SET status='completed',executed_at=?,result_json=?,execution_token_hash=NULL WHERE id=? AND status='executing'").bind(now(),JSON.stringify(result),action.id).run(); await audit(db,request,{type:'action_completed',customerId,sessionId:action.session_id || null,toolName:action.tool_name,pendingActionId:action.id,biometricVerified,executionResult:'completed',metadata:result}); return result; }
  catch(error) { await db.prepare("UPDATE pending_actions SET status='failed',result_json=? WHERE id=? AND status='executing'").bind(JSON.stringify({error:error.message}),action.id).run(); await audit(db,request,{type:'action_failed',customerId,sessionId:action.session_id || null,toolName:action.tool_name,pendingActionId:action.id,biometricVerified,executionResult:'failed',metadata:{error:error.message}}); throw error; }
}
async function apply(db, action, customerId, request) { const p=parse(action.payload_json);
 if (action.tool_name === 'executeResolutionPlan') {
   const plan = await verifyResolutionPlan(db, customerId, p.plan);
   const biometricVerified = Boolean(action.requires_biometric && action.biometric_verified_at);
   const results = [];
   for (const step of plan.steps.filter((item) => !item.read_only)) {
     const policy = await evaluatePolicy({ db, customerId, toolName: step.tool_name, payload: step.payload, userRequest: 'Resolution Plan execution', aiConfidence: 1 });
     if (policy.decision === 'block' || policy.decision === 'escalate') throw new Error(`Policy no longer permits ${step.title}.`);
     await audit(db, request, { type:'resolution_step_started', customerId, sessionId:action.session_id || null, toolName:step.tool_name, actionType:'resolution_step', policyResult:policy.decision, pendingActionId:action.id, biometricVerified, metadata:{ plan_id:plan.id, step_id:step.id } });
     const result = await apply(db, { tool_name: step.tool_name, payload_json: JSON.stringify(step.payload), risk_level: step.risk_level, session_id: action.session_id }, customerId, request);
     results.push({ step_id:step.id, title:step.title, tool_name:step.tool_name, status:'completed', result });
     await audit(db, request, { type:'resolution_step_completed', customerId, sessionId:action.session_id || null, toolName:step.tool_name, actionType:'resolution_step', pendingActionId:action.id, biometricVerified, executionResult:'completed', metadata:{ plan_id:plan.id, step_id:step.id } });
   }
   const readiness = await buildResolutionPlan(db, customerId, plan.source);
   return { action:'executeResolutionPlan', resolution_plan:{ id:plan.id, problem:plan.problem, root_causes:plan.root_causes, expected_result:plan.expected_result, readiness_check:readiness.plan.readiness_check, steps:results, plan_hash:plan.plan_hash } };
 }
 const cardTools={enableOnlinePayments:['online_payment_enabled',1],disableOnlinePayments:['online_payment_enabled',0],enableInternationalPayments:['international_payment_enabled',1],disableInternationalPayments:['international_payment_enabled',0],freezeCard:['status','locked'],unfreezeCard:['status','active']}; if (cardTools[action.tool_name]) { const [column,value]=cardTools[action.tool_name]; const before=await db.prepare('SELECT id,card_number_masked,status,online_payment_enabled,international_payment_enabled,daily_limit,monthly_limit FROM cards WHERE id=? AND customer_id=?').bind(p.card_id,customerId).first(); if (!before) throw new Error('Card not found.'); await db.prepare(`UPDATE cards SET ${column}=? WHERE id=? AND customer_id=?`).bind(value,p.card_id,customerId).run(); const after=await db.prepare('SELECT id,card_number_masked,status,online_payment_enabled,international_payment_enabled,daily_limit,monthly_limit FROM cards WHERE id=?').bind(p.card_id).first(); return { action:action.tool_name,before,after }; }
 if (action.tool_name === 'updateCardDailyLimit') { const before=await db.prepare('SELECT id,card_number_masked,daily_limit,monthly_limit FROM cards WHERE id=? AND customer_id=?').bind(p.card_id,customerId).first(); if (!before) throw new Error('Card not found.'); if (Number(p.daily_limit) > Number(before.monthly_limit)) throw new Error('Daily limit cannot exceed the current monthly limit.'); await db.prepare('UPDATE cards SET daily_limit=? WHERE id=? AND customer_id=?').bind(Number(p.daily_limit),p.card_id,customerId).run(); const after=await db.prepare('SELECT id,card_number_masked,daily_limit,monthly_limit FROM cards WHERE id=?').bind(p.card_id).first(); return { action:action.tool_name,before,after }; }
 if (action.tool_name === 'createSupportTicket' || action.tool_name === 'escalateToHuman' || action.tool_name === 'replaceCard') { const subject=p.subject || (action.tool_name === 'replaceCard' ? 'Card replacement requested' : 'Human support requested'); const ticket={id:id(),customer_id:customerId,subject,description:p.description || `Created from approved ${action.tool_name} action.`,status:'open',priority:action.risk_level === 'high' ? 'high' : 'medium',created_at:now()}; await db.prepare('INSERT INTO support_tickets (id,customer_id,subject,description,status,priority,created_at) VALUES (?,?,?,?,?,?,?)').bind(...Object.values(ticket)).run(); return { action:action.tool_name,ticket:{...ticket,description:undefined} }; }
 if (action.tool_name === 'generateFundingInstructions') return { action:action.tool_name, message:'Funding instructions generated from the bank knowledge base.' };
 if (action.tool_name === 'toggleSavingsFeature') throw new Error('Savings feature execution is unavailable because the source dataset has no customer-scoped savings setting.');
 throw new Error('No execution handler is available for this action.'); }
