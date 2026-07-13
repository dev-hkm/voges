import test from 'node:test';
import assert from 'node:assert/strict';
import { compileResolutionPlan } from '../functions/_lib/resolution-engine.js';

const base = {
  input: { merchant: 'Example merchant' },
  profile: { customer: { account_status: 'active', kyc_status: 'verified' }, accounts: [{ status: 'active', currency: 'PHP', available_balance: 5000 }] },
  kyc: { kyc_status: 'verified' },
};

test('Resolution Autopilot proposes a bounded plan for an online-payment decline', () => {
  const plan = compileResolutionPlan({
    ...base,
    decline: { found: true, plain_reason: 'Online payments are disabled.', transaction: { id: 'tx_1', merchant_name: 'Example merchant', amount: 549, currency: 'PHP', decline_reason: 'online_payment_disabled' } },
    card: { id: 'card_1', masked_number: '**** 4821', status: 'active', online_payment_enabled: false, international_payment_enabled: true, daily_limit: 2000, monthly_limit: 5000 },
  });
  assert.equal(plan.steps[0].tool_name, 'enableOnlinePayments');
  assert.equal(plan.steps.at(-1).tool_name, 'paymentReadinessCheck');
  assert.equal(plan.readiness_check.status, 'ready_after_plan');
});

test('Resolution Autopilot never invents an action when balance remains insufficient', () => {
  const plan = compileResolutionPlan({
    ...base,
    profile: { ...base.profile, accounts: [{ status: 'active', currency: 'PHP', available_balance: 20 }] },
    decline: { found: true, plain_reason: 'Available balance was insufficient.', transaction: { id: 'tx_2', merchant_name: 'Example merchant', amount: 549, currency: 'PHP', decline_reason: 'insufficient_funds' } },
    card: { id: 'card_1', masked_number: '**** 4821', status: 'active', online_payment_enabled: true, international_payment_enabled: true, daily_limit: 2000, monthly_limit: 5000 },
  });
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.readiness_check.status, 'blocked');
  assert.match(plan.readiness_check.blockers.join(' '), /balance/i);
});

test('Resolution Autopilot computes a bounded daily-limit update from verified transaction data', () => {
  const plan = compileResolutionPlan({
    ...base,
    decline: { found: true, plain_reason: 'The daily limit was exceeded.', transaction: { id: 'tx_3', merchant_name: 'Example merchant', amount: 250000, currency: 'PHP', decline_reason: 'daily_limit' } },
    card: { id: 'card_1', masked_number: '**** 4821', status: 'active', online_payment_enabled: true, international_payment_enabled: true, daily_limit: 200000, monthly_limit: 500000 },
  });
  const limitStep = plan.steps.find((step) => step.tool_name === 'updateCardDailyLimit');
  assert.equal(limitStep.payload.daily_limit, 300000);
  assert.equal(limitStep.risk_level, 'high');
});

test('Resolution Autopilot orders unlock before enabling online payments', () => {
  const plan = compileResolutionPlan({
    ...base,
    decline: { found: true, plain_reason: 'Online payments are disabled.', transaction: { id: 'tx_4', merchant_name: 'Example merchant', amount: 549, currency: 'PHP', decline_reason: 'online_payment_disabled' } },
    card: { id: 'card_1', masked_number: '**** 4821', status: 'locked', online_payment_enabled: false, international_payment_enabled: true, daily_limit: 2000, monthly_limit: 5000 },
  });
  const executableSteps = plan.steps.filter((step) => !step.read_only);
  assert.deepEqual(executableSteps.map((step) => step.tool_name), ['unfreezeCard', 'enableOnlinePayments']);
  assert.equal(plan.readiness_check.status, 'ready_after_plan');
});
