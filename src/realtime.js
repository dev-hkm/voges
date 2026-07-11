export {
  REALTIME_MODEL,
  REALTIME_DEFAULT_VOICE,
  REALTIME_VOICES,
  REALTIME_INSTRUCTIONS,
  coerceRealtimeVoice,
  buildTokenSessionConfig,
  buildSessionUpdateConfig,
} from '../shared/realtime-config.js';

const FATAL_ERROR_CODES = new Set([
  'authentication_failed',
  'authorization_failed',
  'invalid_api_key',
  'session_expired',
]);

export function classifyRealtimeError(event) {
  const error = event?.error || {};
  const code = String(error.code || '').toLowerCase();
  const type = String(error.type || '').toLowerCase();
  return {
    fatal: event?.type === 'session.error'
      || FATAL_ERROR_CODES.has(code)
      || type === 'authentication_error'
      || type === 'authorization_error',
    code,
    type,
    message: String(error.message || 'The realtime session returned an error.'),
    eventId: error.event_id || null,
  };
}

export function getResponseOutcome(event) {
  const response = event?.response || {};
  const status = response.status || 'completed';
  const details = response.status_details || {};
  const error = details.error || {};
  return {
    status,
    reason: details.reason || '',
    code: error.code || '',
    message: error.message || '',
    successful: status === 'completed',
    expectedCancellation: status === 'cancelled'
      && ['client_cancelled', 'turn_detected'].includes(details.reason),
  };
}

export function isRealtimeConcurrencyError(event) {
  const code = String(event?.error?.code || '').toLowerCase();
  const message = String(event?.error?.message || '').toLowerCase();
  return code === 'conversation_already_has_active_response'
    || code === 'response_cancel_not_active'
    || message.includes('already has an active response')
    || message.includes('no active response found');
}
