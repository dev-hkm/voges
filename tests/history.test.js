import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveHistory, finalizeSessionSummary, getHistoryDetail } from '../functions/_lib/session-history.js';

function createMockRequest() {
  return {
    headers: {
      get(name) {
        const values = {
          'User-Agent': 'node-test',
          'Accept-Language': 'en-US',
          'CF-Connecting-IP': '127.0.0.1',
        };
        return values[name] || null;
      },
    },
  };
}

function createMockDb(overrides = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return overrides.first?.(sql, args) ?? null;
            },
            async all() {
              return overrides.all?.(sql, args) ?? { results: [] };
            },
            async run() {
              return overrides.run?.(sql, args) ?? { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

test('finalizeSessionSummary creates a deterministic summary from session data', async () => {
  const db = createMockDb({
    first(sql) {
      if (sql.startsWith('SELECT id, customer_id, started_at')) {
        return {
          id: 'session_1',
          customer_id: 'cust_1',
          started_at: '2026-07-10T10:00:00.000Z',
          ended_at: null,
          duration_seconds: 0,
        };
      }
      return null;
    },
    all(sql) {
      if (sql.startsWith('SELECT event_type, tool_name')) {
        return {
          results: [
            {
              event_type: 'tool_read_completed',
              tool_name: 'getRecentTransactions',
              biometric_verified: 0,
              execution_result: 'completed',
              timestamp: '2026-07-10T10:01:00.000Z',
            },
          ],
        };
      }
      if (sql.startsWith('SELECT id, tool_name')) {
        return {
          results: [
            {
              id: 'action_1',
              tool_name: 'enableOnlinePayments',
              display_title: 'Enable online payments',
              status: 'completed',
              result_json: JSON.stringify({ action: 'enableOnlinePayments' }),
              requires_biometric: 1,
              created_at: '2026-07-10T10:02:00.000Z',
            },
          ],
        };
      }
      if (sql.startsWith('SELECT payload_json, created_at FROM session_visual_cards')) {
        return {
          results: [
            {
              payload_json: JSON.stringify({
                type: 'transaction_summary',
                title: 'Recent transactions',
                subtitle: 'Updated just now',
                data: {
                  transactions: [],
                  summary: { count: 0, total_spent: 0, total_received: 0, largest_transaction: null },
                },
                actions: [],
                metadata: {},
              }),
              created_at: '2026-07-10T10:02:00.000Z',
            },
          ],
        };
      }
      return { results: [] };
    },
  });

  const result = await finalizeSessionSummary({
    db,
    request: createMockRequest(),
    customerId: 'cust_1',
    sessionId: 'session_1',
    durationSeconds: 120,
    finalOutcomeHint: '',
  });

  assert.equal(result.primary_intent, 'enable_online_payments');
  assert.equal(result.actions_completed, 1);
  assert.equal(result.biometric_verified, true);
  assert.equal(result.final_outcome, 'Online payments were enabled successfully.');
});

test('getHistoryDetail denies access when session does not belong to the current customer', async () => {
  const db = createMockDb({
    first() {
      return null;
    },
  });

  await assert.rejects(
    () => getHistoryDetail({ db, customerId: 'cust_wrong', sessionId: 'session_1' }),
    /History session not found/,
  );
});

test('archiveHistory performs soft delete semantics', async () => {
  let updateCalled = false;
  const db = createMockDb({
    run(sql) {
      if (sql.startsWith('UPDATE session_summaries SET archived_at')) {
        updateCalled = true;
      }
      return { meta: { changes: 1 } };
    },
  });

  const result = await archiveHistory({
    db,
    request: createMockRequest(),
    customerId: 'cust_1',
    sessionId: 'session_1',
  });

  assert.equal(updateCalled, true);
  assert.equal(result.archived, true);
  assert.equal(result.session_id, 'session_1');
});
