import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActionReceiptPayload } from '../functions/_lib/action-receipt.js';
import { buildVerifiedActionReceiptSummary } from '../functions/_lib/summary-ui.js';

const completedAction = {
  id: 'action_123',
  created_at: '2026-07-13T01:00:00.000Z',
  executed_at: '2026-07-13T01:02:00.000Z',
  status: 'completed',
  display_title: 'Disable online payments',
  tool_name: 'disableOnlinePayments',
  affected_resource: 'Card ending 4242',
  risk_level: 'medium',
  requires_biometric: 1,
  confirmed_at: '2026-07-13T01:01:00.000Z',
  biometric_verified_at: '2026-07-13T01:01:30.000Z',
  policy_decision_json: JSON.stringify({
    decision: 'require_biometric',
    reason: 'A card control change requires customer verification.',
    matchedRules: ['medium_confirmation', 'verified_customer'],
  }),
};

test('action receipt is derived from persisted before and after state', () => {
  const receipt = buildActionReceiptPayload({
    action: completedAction,
    result: {
      action: 'disableOnlinePayments',
      before: { online_payment_enabled: 1, status: 'active' },
      after: { online_payment_enabled: 0, status: 'active' },
    },
    audits: [
      { event_type: 'policy_evaluated', biometric_verified: 0 },
      { event_type: 'webauthn_verified', biometric_verified: 1 },
      { event_type: 'action_completed', biometric_verified: 1 },
    ],
  });

  assert.equal(receipt.persistence.database, 'Cloudflare D1');
  assert.equal(receipt.persistence.committed, true);
  assert.deepEqual(receipt.persistence.state_changes, [{
    field: 'online_payment_enabled',
    label: 'Online payments',
    before: 'Enabled',
    after: 'Disabled',
  }]);
  assert.equal(receipt.verification.method, 'WebAuthn passkey');
  assert.equal(receipt.verification.verified, true);
  assert.equal(receipt.audit.event_count, 3);
});

test('verified receipt summary satisfies the shared UI contract', () => {
  const receipt = {
    ...buildActionReceiptPayload({
      action: completedAction,
      result: { action: 'disableOnlinePayments', before: { online_payment_enabled: 1 }, after: { online_payment_enabled: 0 } },
      audits: [{ event_type: 'action_completed', biometric_verified: 1 }],
    }),
    integrity_hash: 'A'.repeat(43),
  };
  const card = buildVerifiedActionReceiptSummary(receipt);

  assert.equal(card.type, 'verified_action_receipt');
  assert.equal(card.data.status, 'completed');
  assert.equal(card.data.database_status, 'Committed to Cloudflare D1');
  assert.equal(card.actions[0].action, 'receipt:copy');
});

test('confirmation-only receipt never claims cryptographic verification', () => {
  const receipt = {
    ...buildActionReceiptPayload({
      action: {
        ...completedAction,
        id: 'action_confirmation_only',
        requires_biometric: 0,
        biometric_verified_at: null,
      },
      result: { action: 'createSupportTicket', ticket: { id: 'ticket_1', status: 'open' } },
      audits: [{ event_type: 'action_completed', biometric_verified: 0 }],
    }),
    integrity_hash: 'B'.repeat(43),
  };
  const card = buildVerifiedActionReceiptSummary(receipt);

  assert.equal(receipt.verification.method, 'On-screen confirmation');
  assert.equal(card.data.verification_status, 'Confirmed on screen');
});
