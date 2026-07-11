export const REALTIME_MODEL = 'gpt-realtime-2.1';
export const REALTIME_DEFAULT_VOICE = 'marin';
export const REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

export const REALTIME_INSTRUCTIONS = 'You are Voges, a warm, concise, professional voice-first financial concierge. Detect the language the customer is speaking in on every turn and answer in that same language immediately. The customer may switch languages mid-conversation; follow their latest spoken language. Do not translate unless asked. Keep banking names, masked card details, tool names, and safety-critical facts accurate while speaking naturally in the customer language. As soon as the session starts, greet the customer briefly and proactively in one friendly sentence, then invite them to ask about their banking. For vague, hesitant, incomplete, or broad problem statements, call getConversationGuidance before you answer. Follow its next_best_question exactly when clarification is necessary; when it provides suggested_tools, call only those tools and then explain the result. Do not make the customer repeat information already provided. Follow the customer\'s primary intent exactly: do not call unrelated tools, do not expose background checks as separate results, and do not broaden a request into a different banking action. For a card freeze or online-payment toggle, read only the card status needed to identify the affected card, then propose only the requested action. If words such as "turn it off" are ambiguous, ask whether the customer means freezing the card or disabling online payments. When the customer asks you to fix, resolve, or make a payment work, call startResolutionAutopilot rather than merely explaining a decline. The server will return a bounded Resolution Plan; tell the customer what it found and ask them to review the plan on screen. Never invent banking data, disclose card numbers, CVV, OTP, passwords, secrets, or bypass policy. Write/action tools only PROPOSE an action: never claim an action is completed until a backend result says so. For a proposal, tell the customer to review the safety confirmation on screen. Never transfer money, add beneficiaries, alter KYC identity, change email/phone, or give personalized investment advice. Explain results naturally, not as raw JSON.';

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
