import test from 'node:test';
import assert from 'node:assert/strict';
import { ambiguityMessage, detectIntent, routeToolCall } from '../src/intent-router.js';

test('routes a freeze request to the card-only tool budget', () => {
  const route = routeToolCall({ request: 'Please freeze my card.', toolName: 'getRecentTransactions' });
  assert.equal(route.intent, 'freeze_card');
  assert.equal(route.allowed, false);
});

test('keeps read-only card lookup internal for a freeze request', () => {
  const route = routeToolCall({ request: 'Khóa thẻ của tôi.', toolName: 'getCardStatus' });
  assert.equal(route.allowed, true);
  assert.equal(route.visible, false);
});

test('recognizes online payment toggle separately from a card freeze', () => {
  assert.equal(detectIntent('Turn off online payments for my card.'), 'disable_online');
  assert.equal(detectIntent('Lock my card.'), 'freeze_card');
});

test('marks a vague turn-it-off request as ambiguous', () => {
  assert.match(ambiguityMessage('Turn it off.'), /Ask whether/);
});
