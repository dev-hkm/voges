// IMPORTANT: this module is the single gate for response.create.
// OpenAI Realtime allows only one response to write to the default conversation
// at a time. Keeping this state outside React prevents render/timer changes from
// accidentally creating a second response or dropping a pending tool follow-up.
// Do not replace this with ad-hoc channel.send() calls in App.jsx.
const CREATE_TIMEOUT_MS = 15_000;
const MAX_QUEUE_SIZE = 12;

function makeEventId() {
  if (globalThis.crypto?.randomUUID) return `voges_response_${crypto.randomUUID()}`;
  return `voges_response_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getFunctionCallsFromResponse(response) {
  // The supported tool boundary is response.done.response.output. Earlier
  // response.output_item.done events are deliberately ignored by the app.
  return Array.isArray(response?.output)
    ? response.output.filter((item) => item?.type === 'function_call' && item.call_id && item.name)
    : [];
}

export function createRealtimeResponseOrchestrator({ send, onState, onTimeout } = {}) {
  let activeResponseId = null;
  let createPending = false;
  let pendingEventId = null;
  let queue = [];
  let createTimer = null;

  const publish = (reason) => onState?.({
    reason,
    activeResponseId,
    createPending,
    pendingEventId,
    queued: queue.length,
  });

  const clearCreateTimer = () => {
    clearTimeout(createTimer);
    createTimer = null;
  };

  const dispatch = (request) => {
    const eventId = makeEventId();
    const event = {
      event_id: eventId,
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        ...(request.instructions ? { instructions: request.instructions } : {}),
      },
    };

    // `send` is the WebRTC data-channel boundary. REST is only used to mint the
    // ephemeral client secret; it must never be used as the live response path.
    const sent = send?.(event) !== false;
    if (!sent) {
      publish('channel_not_open');
      return false;
    }

    createPending = true;
    pendingEventId = eventId;
    clearCreateTimer();
    createTimer = setTimeout(() => {
      if (!createPending || pendingEventId !== eventId) return;
      createPending = false;
      pendingEventId = null;
      publish('create_timeout');
      onTimeout?.();
    }, CREATE_TIMEOUT_MS);
    publish('response_requested');
    return true;
  };

  const flush = () => {
    if (activeResponseId || createPending || queue.length === 0) return false;
    const next = queue.shift();
    return dispatch(next);
  };

  return {
    request(instructions = '', { priority = false, reason = 'manual' } = {}) {
      const request = { instructions, reason };
      if (activeResponseId || createPending) {
        if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
        if (priority) queue.unshift(request);
        else queue.push(request);
        publish('response_queued');
        return 'queued';
      }
      return dispatch(request) ? 'sent' : 'ignored';
    },

    responseCreated(response) {
      clearCreateTimer();
      createPending = false;
      pendingEventId = null;
      activeResponseId = response?.id || 'unknown';
      publish('response_created');
    },

    responseDone(response, { deferFlush = false } = {}) {
      if (!response?.id || activeResponseId === response.id || activeResponseId === 'unknown') {
        activeResponseId = null;
      }
      clearCreateTimer();
      createPending = false;
      pendingEventId = null;
      publish('response_done');
      if (!deferFlush) flush();
    },

    recoverFromError(event) {
      const errorEventId = event?.error?.event_id || event?.event_id || null;
      if (!errorEventId || errorEventId === pendingEventId) {
        clearCreateTimer();
        createPending = false;
        pendingEventId = null;
      }
      publish('response_error');
      if (!activeResponseId) flush();
    },

    resume() {
      return flush();
    },

    reset() {
      clearCreateTimer();
      activeResponseId = null;
      createPending = false;
      pendingEventId = null;
      queue = [];
      publish('reset');
    },

    snapshot() {
      return { activeResponseId, createPending, pendingEventId, queued: queue.length };
    },
  };
}
