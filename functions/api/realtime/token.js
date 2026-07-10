import { demoCustomerId } from '../../_lib/core.js';
import { createVoiceSession } from '../../_lib/session-history.js';
import { REALTIME_MODEL, REALTIME_DEFAULT_VOICE, buildTokenSessionConfig } from '../../../shared/realtime-config.js';

export async function onRequestGet({ request, env }) {
  if (!env.OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
  }
  const origin = new URL(request.url).origin;
  const identitySource = request.headers.get('CF-Connecting-IP') || request.headers.get('User-Agent') || 'anonymous';
  const identityDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identitySource));
  const safetyIdentifier = Array.from(new Uint8Array(identityDigest), (byte) => byte.toString(16).padStart(2, '0')).join('');

  try {
    // This is phase 1 only: REST mints a short-lived client secret. The browser
    // uses that secret later for the direct WebRTC SDP handshake. Do not move
    // microphone/audio transport into this function or expose OPENAI_API_KEY.
    let voiceSession = null;
    if (env.DB) {
      try {
        const customerId = await demoCustomerId(env.DB);
        voiceSession = await createVoiceSession(env.DB, request, customerId);
      } catch (historyError) {
        console.warn(JSON.stringify({ event: 'voice_history_unavailable', message: historyError?.message || 'unknown_error' }));
      }
    }
    const session = buildTokenSessionConfig({ voice: REALTIME_DEFAULT_VOICE });
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier,
      },
      body: JSON.stringify({ session }),
    });

    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'OpenAI returned a non-JSON token response.' }, { status: 502 });
    }

    if (!response.ok) {
      console.error(JSON.stringify({ event: 'realtime_token_rejected', model: REALTIME_MODEL, upstream_status: response.status, detail: rawBody.slice(0, 400) }));
      return Response.json({ error: data?.error?.message || 'OpenAI rejected the realtime session request.' }, { status: response.status });
    }

    console.log(JSON.stringify({ event: 'realtime_token_created', session_id: voiceSession?.session_id || null, model: REALTIME_MODEL, upstream_status: response.status }));
    return Response.json({ ...data, session_id: voiceSession?.session_id || null }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'realtime_token_failed', model: REALTIME_MODEL, message: error?.message || 'unknown_error' }));
    return Response.json({ error: 'Could not reach the OpenAI Realtime API.' }, { status: 502 });
  }
}
