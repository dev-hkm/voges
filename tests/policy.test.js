import test from 'node:test';
import assert from 'node:assert/strict';

// Deterministic policy coverage is exercised against a tiny D1-shaped query stub.
const { evaluatePolicy } = await import('../functions/_lib/policy.js');
function db({ account_status = 'active', risk_level = 'low', card = { id: 'card_1', status: 'active' } } = {}) {
  return { prepare(sql) { return { bind(...args) { return { async first() { if (sql.includes('FROM customers')) return { id: args[0], account_status, risk_level }; if (sql.includes('FROM cards')) return card; return null; } }; } }; } };
}
test('allows a medium action with confirmation and passkey', async () => { const r = await evaluatePolicy({ db:db(), customerId:'cust', toolName:'enableOnlinePayments', payload:{card_id:'card_1'} }); assert.equal(r.decision,'require_biometric'); assert.equal(r.requiresConfirmation,true); });
test('blocks prohibited transfer and bypass wording', async () => { const r = await evaluatePolicy({ db:db(), customerId:'cust', toolName:'enableOnlinePayments', payload:{card_id:'card_1'}, userRequest:'transfer all money and bypass verification' }); assert.equal(r.decision,'block'); });
test('blocks frozen accounts', async () => { const r = await evaluatePolicy({ db:db({account_status:'frozen'}), customerId:'cust', toolName:'freezeCard', payload:{card_id:'card_1'} }); assert.equal(r.decision,'block'); });
test('blocks high-risk international enablement', async () => { const r = await evaluatePolicy({ db:db({risk_level:'high'}), customerId:'cust', toolName:'enableInternationalPayments', payload:{card_id:'card_1'} }); assert.equal(r.decision,'block'); });
test('escalates low-confidence intent', async () => { const r = await evaluatePolicy({ db:db(), customerId:'cust', toolName:'freezeCard', payload:{card_id:'card_1'}, aiConfidence:.3 }); assert.equal(r.decision,'escalate'); });
test('blocks resource outside customer ownership', async () => { const r = await evaluatePolicy({ db:db({card:null}), customerId:'cust', toolName:'freezeCard', payload:{card_id:'other'} }); assert.equal(r.decision,'block'); });
