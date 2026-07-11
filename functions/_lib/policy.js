const ACTIONS = {
  enableOnlinePayments: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  disableOnlinePayments: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: false, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  enableInternationalPayments: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  disableInternationalPayments: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  toggleSavingsFeature: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: false, allowedAccountStatuses: ['active'], fields: ['enabled'] },
  freezeCard: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  unfreezeCard: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  replaceCard: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id'] },
  createSupportTicket: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: false, allowedAccountStatuses: ['active','frozen','limited'], fields: ['subject'] },
  generateFundingInstructions: { riskLevel: 'medium', requiresConfirmation: true, requiresBiometric: false, allowedAccountStatuses: ['active'], fields: [] },
  escalateToHuman: { riskLevel: 'low', requiresConfirmation: false, requiresBiometric: false, allowedAccountStatuses: ['active','frozen','limited','closed'], fields: ['subject'] },
  updateCardDailyLimit: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['card_id', 'daily_limit'] },
  // A Resolution Plan is one bounded contract. Its child steps are revalidated
  // independently immediately before execution; the model cannot add tools.
  executeResolutionPlan: { riskLevel: 'high', requiresConfirmation: true, requiresBiometric: true, allowedAccountStatuses: ['active'], fields: ['plan_id', 'plan_hash', 'plan'] },
};
export const ACTION_METADATA = Object.entries(ACTIONS).map(([name, value]) => ({ name, auditRequired: true, ...value }));
export const READ_TOOLS = new Set(['getCustomerProfile','getKycStatus','getAccountBalance','getRecentTransactions','getCardStatus','explainDeclineReason','getCardLimits','getProductInformation','generateFundingInstruction']);
const forbidden = /\b(transfer|beneficiar|otp|cvv|password|secret|bypass|full card|card number|change (email|phone|kyc)|investment advice)\b/i;
export async function evaluatePolicy({ db, customerId, toolName, payload = {}, userRequest = '', aiConfidence = 1 }) {
  const meta = ACTIONS[toolName];
  const customer = await db.prepare('SELECT id,risk_level,account_status FROM customers WHERE id=?').bind(customerId).first();
  const rules = [];
  if (!customer) return decision('block', 'blocked', rules.concat('customer_not_found'), 'Customer not found.');
  if (forbidden.test(userRequest) || /^(transfer|addBeneficiary|reveal)/.test(toolName || '')) return decision('block','blocked',rules.concat('prohibited_request'),'This request is prohibited by banking policy.');
  if (!meta) return decision('block','blocked',rules.concat('tool_not_allowlisted'),'This action is not in the approved tool allowlist.');
  if (!Number.isFinite(Number(aiConfidence)) || Number(aiConfidence) < 0.85) return decision('escalate','medium',rules.concat('low_confidence'),'The request needs a human review.');
  for (const field of meta.fields) if (typeof payload[field] !== 'string' && typeof payload[field] !== 'boolean' && typeof payload[field] !== 'number' && typeof payload[field] !== 'object') return decision('block','blocked',rules.concat('invalid_payload'),`Missing or invalid ${field}.`);
  if (toolName === 'updateCardDailyLimit' && (!Number.isFinite(Number(payload.daily_limit)) || Number(payload.daily_limit) <= 0)) return decision('block','blocked',rules.concat('invalid_limit'),'The requested card limit is invalid.');
  if (toolName === 'executeResolutionPlan' && (!payload.plan || payload.plan.plan_hash !== payload.plan_hash || payload.plan.id !== payload.plan_id)) return decision('block','blocked',rules.concat('invalid_resolution_plan'),'The Resolution Plan contract is invalid.');
  if (!meta.allowedAccountStatuses.includes(customer.account_status)) return decision('block','blocked',rules.concat('account_status'),'This account is not permitted to perform that action.');
  if (customer.account_status === 'frozen' && meta.riskLevel !== 'low') return decision('block','blocked',rules.concat('frozen_account'),'Financial changes are unavailable while the account is frozen.');
  let card = null;
  if (payload.card_id) { card = await db.prepare('SELECT id,status,card_number_masked FROM cards WHERE id=? AND customer_id=?').bind(payload.card_id, customerId).first(); if (!card) return decision('block','blocked',rules.concat('resource_ownership'),'The selected card does not belong to this customer.'); }
  if (/enable.*Payments/.test(toolName) && card?.status === 'locked') return decision('block','blocked',rules.concat('locked_card'),'Unlock the card before enabling payments.');
  if (toolName === 'enableInternationalPayments' && customer.risk_level === 'high') return decision('block','blocked',rules.concat('high_risk_customer'),'International payments require a human review for this risk profile.');
  return { decision: meta.requiresBiometric ? 'require_biometric' : 'allow_with_confirmation', riskLevel: meta.riskLevel, requiresConfirmation: meta.requiresConfirmation, requiresBiometric: meta.requiresBiometric, matchedRules: rules.concat('allowlisted_tool'), reason: 'The action meets the deterministic policy requirements.', expiresInSeconds: 300, customer, card, metadata: meta };
}
function decision(decision, riskLevel, matchedRules, reason) { return { decision, riskLevel, requiresConfirmation: false, requiresBiometric: false, matchedRules, reason, expiresInSeconds: 0 }; }
