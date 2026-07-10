import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSummaryResponse } from '../shared/ui-contracts.js';
import { buildSummaryForTool } from '../functions/_lib/summary-ui.js';

test('invalid summary payload falls back to generic_info', () => {
  const result = validateSummaryResponse({
    spoken_response: 'Hello',
    ui: {
      type: 'transaction_summary',
      title: 'Broken',
      subtitle: '',
      data: {},
      actions: [],
      metadata: {},
    },
  });

  assert.equal(result.ui.type, 'generic_info');
  assert.equal(result.ui.title, 'Broken');
});

test('card status summary keeps only last four digits', () => {
  const result = buildSummaryForTool('getCardStatus', {
    cards: [
      {
        id: 'card_1',
        masked_number: '**** **** **** 4242',
        type: 'physical',
        status: 'active',
        online_payment_enabled: 1,
        international_payment_enabled: 0,
        contactless_enabled: 1,
        daily_limit: 2000000,
        daily_spend: 450000,
        currency: 'VND',
      },
    ],
  });

  assert.equal(result.ui.type, 'card_status');
  assert.equal(result.ui.data.cards[0].last_four, '4242');
  assert.equal(result.ui.data.cards[0].kind, 'physical');
});
