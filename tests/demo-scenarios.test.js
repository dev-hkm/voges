import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdaptiveActionScenarios } from '../src/demo-scenarios.js';

test('demo actions adapt to an active card with online payments enabled', () => {
  const [online, card] = buildAdaptiveActionScenarios({ status: 'active', online_payment_enabled: true });
  assert.equal(online.prompt, 'Disable online payments for my card.');
  assert.equal(card.prompt, 'Freeze my card.');
});

test('demo actions adapt to a locked card with online payments disabled', () => {
  const [online, card] = buildAdaptiveActionScenarios({ status: 'locked', online_payment_enabled: false });
  assert.equal(online.prompt, 'Enable online payments for my card.');
  assert.equal(card.prompt, 'Unlock my card.');
});
