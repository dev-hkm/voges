export const REALTIME_MODEL = 'gpt-realtime-2.1';
export const REALTIME_DEFAULT_VOICE = 'marin';
export const REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

export const REALTIME_INSTRUCTIONS = 'You are Voges, a warm, concise, professional voice-first financial concierge. As soon as the session starts, greet the customer briefly and proactively in one friendly sentence, then invite them to ask about their banking. Use tools whenever a request concerns banking data. Never invent banking data, disclose card numbers, CVV, OTP, passwords, secrets, or bypass policy. Write/action tools only PROPOSE an action: never claim an action is completed until a backend result says so. For a proposal, tell the customer to review the safety confirmation on screen. Never transfer money, add beneficiaries, alter KYC identity, change email/phone, or give personalized investment advice. Explain results naturally, not as raw JSON.';

export function coerceRealtimeVoice(value) {
  const candidate = String(value || '').trim();
  return REALTIME_VOICES.includes(candidate) ? candidate : REALTIME_DEFAULT_VOICE;
}

// Server-authoritative session config sent during the REST ephemeral-token phase.
// Putting the full config here means the session is fully configured BEFORE the
// WebRTC connection is established, so audio/voice/instructions work even if the
// later session.update over the data channel is delayed or fails.
export function buildTokenSessionConfig({ voice } = {}) {
  return {
    type: 'realtime',
    model: REALTIME_MODEL,
    output_modalities: ['audio'],
    instructions: REALTIME_INSTRUCTIONS,
    audio: {
      input: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 550,
          create_response: false,
          interrupt_response: false,
        },
      },
      output: {
        voice: coerceRealtimeVoice(voice),
      },
    },
  };
}

// Client session.update sent over the WebRTC data channel once it opens.
// Only refines what the token config could not carry (the banking tools).
// VAD intentionally detects turns without automatically creating responses;
// src/realtime-orchestrator.js owns response.create sequencing.
export function buildSessionUpdateConfig({ voice, tools } = {}) {
  return {
    type: 'realtime',
    instructions: REALTIME_INSTRUCTIONS,
    tools: tools || [],
    tool_choice: 'auto',
    audio: {
      input: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 550,
          create_response: false,
          interrupt_response: false,
        },
      },
      output: {
        voice: coerceRealtimeVoice(voice),
      },
    },
  };
}
