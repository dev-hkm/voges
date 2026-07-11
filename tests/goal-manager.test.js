import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationGuidance } from '../functions/_lib/goal-manager.js';

test('asks only for payment channel when a card issue is vague', () => {
  const guidance = buildConversationGuidance({ userRequest: "My card doesn't work." });
  assert.equal(guidance.completion_status, 'needs_clarification');
  assert.match(guidance.next_best_question, /online purchase/i);
});

test('investigates when customer is unsure after describing a card problem', () => {
  const guidance = buildConversationGuidance({ userRequest: "I don't know.", priorContext: [{ content: "My card doesn't work." }] });
  assert.deepEqual(guidance.suggested_tools, ['getRecentTransactions', 'getCardStatus']);
});

test('guides ambiguous limit requests to one precise question', () => {
  const guidance = buildConversationGuidance({ userRequest: 'I want to increase my limit.' });
  assert.match(guidance.next_best_question, /card spending limit/i);
});
