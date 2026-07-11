import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateScamRisk } from '../functions/_lib/scam-risk.js';

const knowledge = JSON.parse(await readFile(new URL('../sample_data/luadao.json.txt', import.meta.url), 'utf8'));

test('uses the supplied scam knowledge to identify a high-risk impersonation request', () => {
  const result = evaluateScamRisk('A bank caller said my account will be locked unless I give them my OTP now.', knowledge);
  assert.equal(result.level, 'high');
  assert.ok(result.matched_patterns.length > 0);
  assert.ok(result.recommendation.length > 0);
});

test('does not invent a risk finding for unrelated banking activity', () => {
  const result = evaluateScamRisk('Please show my recent transactions.', knowledge);
  assert.equal(result.level, 'none');
});
