import test from 'node:test';
import assert from 'node:assert/strict';
import { describeRealtimeAccess, REALTIME_PREVIEW_SECONDS } from '../functions/_lib/realtime-access.js';

test('a new network receives one 90-second voice preview', () => {
  assert.deepEqual(describeRealtimeAccess(null), {
    available: true,
    limit_seconds: REALTIME_PREVIEW_SECONDS,
    reason: null,
  });
});

test('an issued preview permanently blocks another owner-funded token', () => {
  const access = describeRealtimeAccess({
    status: 'issued',
    token_issued_at: '2026-07-15T00:00:00.000Z',
  });
  assert.equal(access.available, false);
  assert.match(access.reason, /already been used/i);
});

test('an active reservation blocks concurrent token requests', () => {
  const now = Date.parse('2026-07-15T00:01:00.000Z');
  const access = describeRealtimeAccess({
    status: 'reserved',
    reserved_at: '2026-07-15T00:00:30.000Z',
  }, now);
  assert.equal(access.available, false);
  assert.match(access.reason, /already being prepared/i);
});

test('a stale reservation can be recovered after an upstream failure', () => {
  const now = Date.parse('2026-07-15T00:05:00.000Z');
  const access = describeRealtimeAccess({
    status: 'reserved',
    reserved_at: '2026-07-15T00:00:00.000Z',
  }, now);
  assert.equal(access.available, true);
});
