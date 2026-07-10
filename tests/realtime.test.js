import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRealtimeError,
  coerceRealtimeVoice,
  buildSessionUpdateConfig,
  getResponseOutcome,
  isRealtimeConcurrencyError,
} from '../src/realtime.js';
import { buildTokenSessionConfig } from '../shared/realtime-config.js';
import {
  createRealtimeResponseOrchestrator,
  getFunctionCallsFromResponse,
} from '../src/realtime-orchestrator.js';

test('sanitizes voice and creates a complete data-channel session update', () => {
  assert.equal(coerceRealtimeVoice('breeze'), 'marin');
  const config = buildSessionUpdateConfig({ voice: 'cedar', tools: [] });
  assert.equal(config.type, 'realtime');
  assert.equal(config.audio.output.voice, 'cedar');
  assert.equal(config.audio.input.turn_detection.type, 'server_vad');
  assert.equal(config.audio.input.turn_detection.create_response, false);
  assert.equal(config.audio.input.turn_detection.interrupt_response, false);
  assert.equal('format' in config.audio.input, false);
  assert.equal('format' in config.audio.output, false);
});

test('builds a server-authoritative token session config', () => {
  const config = buildTokenSessionConfig({ voice: 'cedar' });
  assert.equal(config.type, 'realtime');
  assert.equal(config.model, 'gpt-realtime-2.1');
  assert.deepEqual(config.output_modalities, ['audio']);
  assert.equal(config.audio.output.voice, 'cedar');
  assert.equal(typeof config.instructions, 'string');
  assert.equal('modalities' in config, false);
  assert.equal('input_audio_format' in config.audio.input, false);
});

test('keeps ordinary realtime errors recoverable', () => {
  const result = classifyRealtimeError({ type: 'error', error: { type: 'invalid_request_error', code: 'response_cancel_not_active', message: 'No response to cancel.' } });
  assert.equal(result.fatal, false);
});

test('classifies session and authentication failures as fatal', () => {
  assert.equal(classifyRealtimeError({ type: 'session.error', error: { message: 'Session failed.' } }).fatal, true);
  assert.equal(classifyRealtimeError({ type: 'error', error: { code: 'authentication_failed', message: 'Unauthorized.' } }).fatal, true);
});

test('distinguishes completed, cancelled, and failed responses', () => {
  assert.equal(getResponseOutcome({ response: { status: 'completed' } }).successful, true);
  assert.equal(getResponseOutcome({ response: { status: 'cancelled', status_details: { reason: 'turn_detected' } } }).expectedCancellation, true);
  assert.equal(getResponseOutcome({ response: { status: 'failed', status_details: { error: { message: 'Failed.' } } } }).successful, false);
});

test('recognizes VAD and explicit cancellation as expected response endings', () => {
  assert.equal(getResponseOutcome({ response: { status: 'cancelled', status_details: { reason: 'client_cancelled' } } }).expectedCancellation, true);
  assert.equal(getResponseOutcome({ response: { status: 'cancelled', status_details: { reason: 'turn_detected' } } }).expectedCancellation, true);
});

test('recognizes recoverable response concurrency errors', () => {
  assert.equal(isRealtimeConcurrencyError({ error: { message: 'Conversation already has an active response in progress.' } }), true);
  assert.equal(isRealtimeConcurrencyError({ error: { code: 'response_cancel_not_active' } }), true);
  assert.equal(isRealtimeConcurrencyError({ error: { code: 'authentication_failed' } }), false);
});

test('orchestrator sends one response and queues later requests until done', () => {
  const events = [];
  const orchestrator = createRealtimeResponseOrchestrator({ send: (event) => events.push(event) });
  assert.equal(orchestrator.request('first'), 'sent');
  assert.equal(orchestrator.request('second'), 'queued');
  assert.equal(events.length, 1);
  orchestrator.responseCreated({ id: 'resp_1' });
  orchestrator.responseDone({ id: 'resp_1' });
  assert.equal(events.length, 2);
  assert.equal(events[1].response.instructions, 'second');
  orchestrator.reset();
});

test('orchestrator defers queued response while function tools are handled', () => {
  const events = [];
  const orchestrator = createRealtimeResponseOrchestrator({ send: (event) => events.push(event) });
  orchestrator.request('first');
  orchestrator.responseCreated({ id: 'resp_1' });
  orchestrator.request('later');
  orchestrator.responseDone({ id: 'resp_1' }, { deferFlush: true });
  assert.equal(events.length, 1);
  orchestrator.request('tool result', { priority: true });
  assert.equal(events.length, 2);
  assert.equal(events[1].response.instructions, 'tool result');
  orchestrator.reset();
});

test('extracts function calls only from completed response output', () => {
  const calls = getFunctionCallsFromResponse({ output: [
    { type: 'message', id: 'msg_1' },
    { type: 'function_call', call_id: 'call_1', name: 'getCardStatus', arguments: '{}' },
  ] });
  assert.deepEqual(calls.map((call) => call.call_id), ['call_1']);
});
