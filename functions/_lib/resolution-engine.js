import { executeBankingTool } from './banking.js';
import { id, sha256 } from './core.js';

// Resolution Autopilot is deliberately deterministic. The realtime model may
// request an investigation, but it never decides what may be executed. This
// module derives the diagnosis, plan and readiness result from D1 tool output.

const CAUSE_COPY = {
  online_payment_disabled: 'Online payments are disabled',
  daily_limit: 'The daily card limit is too low for this payment',
  monthly_limit: 'The monthly card limit is preventing this payment',
  insufficient_funds: 'Available balance is insufficient',
  international_disabled: 'International payments are disabled',
  expired_card: 'The card has expired',
  locked_card: 'The card is locked',
  kyc_required: 'Additional identity verification is required',
  suspicious_activity: 'The payment requires a security review',
  fraud_detected: 'The payment was stopped by fraud monitoring',
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonical(value[key]);
      return result;
    }, {});
  }
  return value;
}

function maxRisk(steps) {
  if (steps.some((step) => step.risk_level === 'high')) return 'high';
  if (steps.some((step) => step.risk_level === 'medium')) return 'medium';
  return 'low';
}

function nextDailyLimit(card, amount) {
  const current = Number(card?.daily_limit || 0);
  const monthly = Number(card?.monthly_limit || 0);
  const floor = Math.max(current * 1.25, Number(amount || 0) * 1.2);
  const proposed = Math.ceil(floor / 100) * 100;
  return monthly > 0 && proposed <= monthly ? proposed : null;
}

function activeAccountForCurrency(accounts, currency) {
  return (accounts || []).find((account) => account.status === 'active' && account.currency === currency)
    || (accounts || []).find((account) => account.status === 'active')
    || null;
}

function readInput(input = {}) {
  return {
    transaction_id: typeof input.transaction_id === 'string' ? input.transaction_id : null,
    merchant: typeof input.merchant === 'string' ? input.merchant.trim() : null,
  };
}

export function compileResolutionPlan({ input, decline, card, profile, kyc }) {
  const transaction = decline?.transaction || null;
  if (!transaction || !decline?.found) {
    return {
      problem: input.merchant ? `A payment at ${input.merchant}` : 'A payment issue',
      root_causes: [{ code: 'transaction_not_found', label: 'No matching declined transaction was found', status: 'unknown', detail: 'Voges cannot safely resolve a payment that it cannot verify.' }],
      steps: [],
      expected_result: 'A verified declined payment is required before a resolution can be planned.',
      requires_biometric: false,
      estimated_risk: 'low',
      readiness_check: { status: 'blocked', blockers: ['No matching declined transaction was found.'], checks: [] },
      source: input,
    };
  }

  const reason = transaction.decline_reason || 'unknown';
  const selectedCard = card || null;
  const account = activeAccountForCurrency(profile?.accounts, transaction.currency);
  const causes = [];
  const steps = [];
  const readinessChecks = [];
  const addCheck = (label, passed, blocker) => {
    readinessChecks.push({ label, status: passed ? 'clear' : 'blocked', detail: passed ? 'Clear' : blocker });
  };

  causes.push({
    code: reason,
    label: CAUSE_COPY[reason] || 'A verified card or account restriction prevented the payment',
    status: 'blocking',
    detail: decline.plain_reason || 'The bank recorded this decline reason.',
  });

  const cardActive = selectedCard?.status === 'active';
  const onlineEnabled = Boolean(selectedCard?.online_payment_enabled);
  const internationalEnabled = Boolean(selectedCard?.international_payment_enabled);
  const balanceEnough = account ? Number(account.available_balance || 0) >= Number(transaction.amount || 0) : false;
  const kycClear = profile?.customer?.kyc_status === 'verified' && kyc?.kyc_status === 'verified';
  const accountClear = profile?.customer?.account_status === 'active';

  addCheck('Account status', accountClear, 'The account is restricted.');
  addCheck('KYC status', kycClear, 'KYC needs review before this payment can proceed.');
  addCheck('Card status', cardActive, selectedCard?.status === 'locked' ? 'The card is locked.' : 'The card is unavailable.');
  addCheck('Online payments', onlineEnabled, 'Online payments are disabled.');
  addCheck('International payments', internationalEnabled, 'International payments are disabled.');
  addCheck('Available balance', balanceEnough, 'Available balance is insufficient.');

  if (reason === 'online_payment_disabled' && selectedCard) {
    steps.push({ id: 'enable-online-payments', tool_name: 'enableOnlinePayments', title: 'Enable online payments', description: `Enable online payments for card ending ${String(selectedCard.masked_number || '').replace(/\D/g, '').slice(-4)}.`, payload: { card_id: selectedCard.id }, risk_level: 'medium', estimated_effect: 'Online merchant payments can proceed.' });
  }
  if (reason === 'daily_limit' && selectedCard) {
    const newLimit = nextDailyLimit(selectedCard, transaction.amount);
    if (newLimit) {
      steps.push({ id: 'increase-daily-limit', tool_name: 'updateCardDailyLimit', title: 'Increase daily limit', description: `Increase the daily limit from ${selectedCard.daily_limit} to ${newLimit}.`, payload: { card_id: selectedCard.id, daily_limit: newLimit }, risk_level: 'high', estimated_effect: 'The verified payment amount fits within the daily limit.' });
    } else {
      causes.push({ code: 'daily_limit_requires_review', label: 'The required limit change exceeds the permitted monthly limit', status: 'blocking', detail: 'A human review is required.' });
      steps.push({ id: 'limit-review', tool_name: 'createSupportTicket', title: 'Request a limit review', description: 'Create a support request for a permitted card-limit change.', payload: { subject: 'Card limit review requested', description: 'Resolution Autopilot found a daily-limit decline that cannot be safely resolved within the current monthly limit.' }, risk_level: 'medium', estimated_effect: 'A support specialist can review the limit safely.' });
    }
  }
  if (reason === 'international_disabled' && selectedCard) {
    steps.push({ id: 'enable-international-payments', tool_name: 'enableInternationalPayments', title: 'Enable international payments', description: 'Enable international payments for the affected card.', payload: { card_id: selectedCard.id }, risk_level: 'high', estimated_effect: 'The card can be used with international merchants.' });
  }
  if (reason === 'locked_card' && selectedCard) {
    steps.push({ id: 'unlock-card', tool_name: 'unfreezeCard', title: 'Unlock card', description: 'Unlock the affected card after device verification.', payload: { card_id: selectedCard.id }, risk_level: 'high', estimated_effect: 'The card can be checked for payment readiness.' });
  }
  if (['kyc_required', 'expired_card', 'suspicious_activity', 'fraud_detected', 'monthly_limit'].includes(reason)) {
    steps.push({ id: 'create-support-ticket', tool_name: 'createSupportTicket', title: 'Create support ticket', description: 'Create a secure support request for the remaining verified blocker.', payload: { subject: `Resolution support requested: ${transaction.merchant_name || 'payment'}`, description: `Resolution Autopilot identified ${CAUSE_COPY[reason] || 'a verified payment restriction'}.` }, risk_level: 'medium', estimated_effect: 'A qualified support specialist can continue the resolution.' });
  }

  const blockers = readinessChecks.filter((check) => check.status === 'blocked').map((check) => check.detail);
  const fixable = new Set(steps.map((step) => step.tool_name));
  const postPlanBlockers = blockers.filter((blocker) => !(
    (blocker.includes('Online payments') && fixable.has('enableOnlinePayments'))
    || (blocker.includes('International payments') && fixable.has('enableInternationalPayments'))
    || (blocker.includes('card is locked') && fixable.has('unfreezeCard'))
  ));

  const readiness = {
    status: postPlanBlockers.length ? 'blocked' : 'ready_after_plan',
    blockers: postPlanBlockers,
    checks: readinessChecks,
  };

  if (steps.length) {
    steps.push({ id: 'readiness-check', tool_name: 'paymentReadinessCheck', title: 'Run payment readiness check', description: 'Re-evaluate verified card, account and policy blockers after the plan completes.', payload: { transaction_id: transaction.id }, risk_level: 'low', estimated_effect: 'Confirm whether it is safe to retry the payment.', read_only: true });
  }

  return {
    problem: `${transaction.merchant_name || 'Payment'} payment failed`,
    root_causes: causes,
    steps,
    expected_result: readiness.status === 'ready_after_plan' ? 'Ready to retry payment' : 'Remaining blockers will be clearly reported',
    requires_biometric: steps.some((step) => !step.read_only),
    estimated_risk: maxRisk(steps),
    readiness_check: readiness,
    source: { transaction_id: transaction.id, merchant: transaction.merchant_name || null },
  };
}

export async function buildResolutionPlan(db, customerId, rawInput = {}) {
  const input = readInput(rawInput);
  const recent = await executeBankingTool(db, 'getRecentTransactions', { merchant: input.merchant || undefined, limit: 10 }, customerId);
  const matching = input.transaction_id
    ? (recent.transactions || []).find((transaction) => transaction.id === input.transaction_id)
    : (recent.transactions || []).find((transaction) => transaction.status === 'declined');
  const decline = await executeBankingTool(db, 'explainDeclineReason', input.transaction_id
    ? { transaction_id: input.transaction_id }
    : matching ? { transaction_id: matching.id } : { merchant: input.merchant || undefined }, customerId);
  const profile = await executeBankingTool(db, 'getCustomerProfile', {}, customerId);
  const kyc = await executeBankingTool(db, 'getKycStatus', {}, customerId);
  const cards = decline?.transaction?.card_number_masked
    ? await executeBankingTool(db, 'getCardStatus', {}, customerId)
    : { cards: [] };
  const card = (cards.cards || []).find((item) => item.masked_number === decline?.transaction?.card_number_masked) || null;
  const plan = compileResolutionPlan({ input, decline, card, profile, kyc });
  const planHash = await sha256(JSON.stringify(canonical(plan)));
  return {
    plan: { id: id(), ...plan, plan_hash: planHash },
    evidence: { recent, decline, card_status: cards, profile, kyc },
  };
}

export async function verifyResolutionPlan(db, customerId, suppliedPlan) {
  if (!suppliedPlan?.source?.transaction_id || !suppliedPlan?.plan_hash) throw new Error('Resolution Plan is invalid.');
  const { plan } = await buildResolutionPlan(db, customerId, { transaction_id: suppliedPlan.source.transaction_id, merchant: suppliedPlan.source.merchant });
  if (plan.plan_hash !== suppliedPlan.plan_hash) throw new Error('The banking context changed. Generate and approve a new Resolution Plan.');
  return plan;
}
