# Voges Architecture Guardrails

This file is intentionally placed at repository root so an AI or developer sees it before modifying Voges.

## Voice architecture is two different phases

```text
REST /api/realtime/token
  Pages Function uses the Cloudflare AI binding to reach AI Gateway
  server uses OPENAI_API_KEY only on that server-side request
  server requests an ephemeral client secret through the provider-native gateway route
  response returns client secret value

WebRTC
  browser gets microphone
  browser creates RTCPeerConnection + oai-events data channel
  browser posts SDP offer directly to OpenAI with ephemeral key
  OpenAI returns SDP answer
  browser sets remote description
  data channel receives Realtime events
```

Do not combine these phases. The REST endpoint mints credentials; it is not the live audio transport. The WebRTC call carries audio and Realtime events.

## Production Realtime routing: do not remove the AI binding

The Pages Function's nearest edge can be a region where OpenAI rejects server-side requests with:

```text
Country, region, or territory not supported
```

`functions/api/realtime/token.js` therefore obtains the provider-native OpenAI URL from `env.AI.gateway('default').getUrl('openai')`. This makes the request travel through Cloudflare AI Gateway rather than directly from the request's nearest Pages edge. `wrangler.toml` must retain:

```toml
[ai]
binding = "AI"
```

Cloudflare requirements for this deployment:

1. Smart Placement is enabled for both Pages production and preview.
2. The `default` AI Gateway is configured to allow the Pages Function route (currently gateway authentication is off; alternatively use a correctly scoped AI Gateway Run credential server-side).
3. `OPENAI_API_KEY` remains an encrypted Pages secret. It must never be copied into React, a Vite variable, or a browser request.

If voice fails before WebRTC begins, check `/api/realtime/token` first. A healthy response is HTTP 200 with a short-lived `value` and `session.model === "gpt-realtime-2.1"`. Do not change the browser transport to REST or WebSocket as a workaround.

## Realtime response rules

Voges uses `server_vad` only to detect speech turns. It intentionally sets:

```js
create_response: false
interrupt_response: false
```

The client response orchestrator in `src/realtime-orchestrator.js` is the only component allowed to send `response.create`.

Why: if Server VAD automatically creates a response while the client also creates one, OpenAI can return `conversation_already_has_active_response`.

Rules:

1. User audio ending (`input_audio_buffer.speech_stopped`) requests one response through the orchestrator.
2. Text input requests one response through the orchestrator.
3. A greeting requests one response through the orchestrator.
4. Tool calls are read from `response.done.response.output`.
5. Do not execute tools from `response.output_item.done`; that event arrives before the parent response is complete.
6. After all tool outputs are sent as `conversation.item.create` with `type: function_call_output`, request exactly one follow-up response.
7. Never call `channel.send({ type: 'response.create' })` directly from feature code.
8. On interruption, send `response.cancel` and then `output_audio_buffer.clear`; do not invent a second response.

## React lifecycle rule

`stopSession` is used by the unmount cleanup effect. It must remain referentially stable while a session is alive.

Do not put live timer state such as `sessionSeconds` or transient UI state such as `successState` into the dependency chain of `stopSession`. Doing so causes React to run the previous effect cleanup every time the state changes, which disconnects WebRTC after the first timer tick.

The current code stores these values in refs:

```js
sessionSecondsRef
successStateRef
```

Keep that design. If a new value is needed by `stopSession`, mirror it into a ref instead of adding rapidly changing state to its dependencies.

## Readiness rule

WebRTC `connectionState === 'connected'` means the transport exists; it does not mean the Realtime session is configured. The UI becomes ready only after `session.updated` is received.

## Action/security rule

The voice model may propose a write tool. It must never execute a write directly.

```text
propose → policy → pending action → visible approval
→ WebAuthn when required → backend verification → execution → audit
```

Frontend state is presentation only. Customer identity, risk, biometric status and execution authority are server-side.

## Safe change checklist

Before editing voice logic:

```bash
npm run typecheck
npm test
npm run build
npx wrangler pages functions build --outdir .wrangler/functions-check
```

After editing voice logic, test:

- fresh session start;
- greeting;
- at least two spoken turns;
- typed message while idle;
- interruption while assistant speaks;
- read tool (`Why was my Netflix payment declined?`);
- action proposal and cancellation;
- action approval/passkey if available;
- session stop and restart.

Never commit `.dev.vars`, `.env`, Cloudflare tokens, OpenAI keys, passkey private material, or raw audio.

See `VOGES_PROJECT_HANDOFF.md` for the full system handoff.
