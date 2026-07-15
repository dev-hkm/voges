# Voges

> **Voges** is a voice-first financial concierge built for AABW / GoTyme P3.
>
> **Voice is the primary interface. The screen is the safety layer.**

Live demo: [voges.pages.dev](https://voges.pages.dev)

## Built with Codex

Voges was designed and implemented collaboratively with **OpenAI Codex** (the coding agent used for this project). Codex inspected the workspace and `sample_data`, shaped the Cloudflare-native architecture, implemented the banking tool and policy layers, wired realtime voice, added WebAuthn step-up verification, debugged production failures, and verified the deployed Pages endpoints.

The implementation was developed against real demo behavior: microphone permissions, WebRTC negotiation, Realtime GA API changes, D1-backed tool responses, approval flows, and audit records were tested and corrected before deployment. Frontend work from the wider collaboration loop is preserved in the latest `main` history.

## Product

Voges combines a live voice agent with a visible safety layer:

`Voice conversation -> intent understanding -> banking tools -> policy -> approval -> WebAuthn -> execution -> audit -> spoken result`

Read-only questions can be answered immediately. Medium- and high-risk changes never execute directly from model output. They become an expiring pending action, require visible approval, and high-risk actions require a platform authenticator such as Windows Hello, Face ID, Touch ID, or a device passkey.

## V3 security architecture

Voges keeps its browser-to-OpenAI Realtime voice connection intact. Banking reads remain tool calls; every write starts as a proposal and moves through a deterministic Cloudflare Pages policy check, an expiring pending action, visible user approval, WebAuthn, server-side execution, and an append-only audit log.

`Voice → proposed action → policy → approval → passkey → execute → audit → spoken result`

Voges uses real WebAuthn cryptographic authentication. The application never receives fingerprint or facial biometric data. The browser and operating system perform local user verification and return a signed WebAuthn assertion.

### Required environment variables

```
OPENAI_API_KEY=...
WEBAUTHN_RP_ID=voges.pages.dev
WEBAUTHN_RP_NAME=Voges
WEBAUTHN_ORIGIN=https://voges.pages.dev
EXECUTION_TOKEN_SECRET=<long-random-secret>
```

For local development use `WEBAUTHN_RP_ID=localhost` and `WEBAUTHN_ORIGIN=http://localhost:5173`. Passkeys are scoped to their RP ID, so register again in production.

### D1 migration and deployment

Run `npm run d1:v3:local` after the V2 seed locally, and `npm run d1:v3:remote` once against the production D1 database. Then build with `npm run build` and deploy Pages with `npx wrangler pages deploy dist --project-name voges`.

### Testing the real flow

Open Security & Policies, select **Set up device authentication**, and complete the native browser prompt. On Chrome Android it can use a device passkey/fingerprint/PIN; Safari iOS uses Face ID/Touch ID/passcode; Windows can use Windows Hello. Ask Voges to enable online payments, review the sheet, then verify with the device. Cancelling or failing the native prompt does not execute the action.

This demo resolves the seeded demo customer server-side because V1/V2 has no end-user login identity. A production multi-customer rollout must bind the authenticated account identity to the customer record; the frontend customer ID is ignored by V3 action endpoints.

Mobile-first realtime voice chat using React, Vite, Cloudflare Pages Functions, and OpenAI Realtime API.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.dev.vars.example` to `.dev.vars` and set `OPENAI_API_KEY` locally.
3. Run the full Cloudflare Pages app: `npm run dev`

The complete app, including Pages Functions, is ready at `http://localhost:5173`. Use `npm run dev:ui` only for frontend-only styling work; realtime voice cannot work in that mode because it does not run Pages Functions.

## Cloudflare setup

Set `OPENAI_API_KEY` as an encrypted secret in the Pages project under Settings > Variables and Secrets. Do not put it in `wrangler.toml` or frontend code.

The production Pages Function uses the `AI` binding declared in `wrangler.toml` to mint Realtime client secrets through Cloudflare AI Gateway. Keep Smart Placement enabled in **Workers & Pages → Voges → Settings → Runtime** for both production and preview. The `default` AI Gateway must permit the server-side provider-native request; for this demo its gateway authentication is disabled. If authentication is re-enabled later, configure a scoped AI Gateway Run credential on the server before deploying.

Verify the deployment before a demo:

```bash
curl https://voges.pages.dev/api/realtime/token
```

It must return HTTP 200 with a short-lived `value` and a session model of `gpt-realtime-2.1`.

The app uses `gpt-realtime-2.1` and WebRTC. Optional D1, R2, KV, and Queues bindings are documented in `wrangler.toml` for persistence, media exports, session state, and background events.

## V2 banking layer

V2 uses the D1 database bound as `DB`. It imports the existing source-of-truth files in `sample_data/` without generating new data:

- `npm run d1:seed:local` initializes the local D1 database.
- `npm run d1:seed:remote` imports the same schema and seed into the remote `voges-banking` database.

The Pages Function tool layer lives in `functions/_lib/banking.js`. Its read tools query D1; `createSupportTicket` deliberately returns `Action Proposed` and never writes data. V3 adds the deterministic policy, approval, WebAuthn, pending-action, and audit layers around sensitive actions.

## How GPT Realtime is used

Voges uses the OpenAI Realtime API with WebRTC as its live voice transport:

1. The browser requests microphone access with `getUserMedia()`.
2. A Cloudflare Pages Function mints a short-lived Realtime client secret using the server-side `OPENAI_API_KEY`.
3. The browser creates a peer connection and sends microphone audio over WebRTC to the Realtime session.
4. GPT Realtime returns assistant audio for natural turn-taking and conversation.
5. Realtime transcript events are forwarded to the backend planner for banking intent and tool orchestration.
6. Banking tools remain server-side on Cloudflare Pages Functions; the voice model cannot call D1 directly.
7. Approved results are sent back through the Realtime data channel so Voges can speak the result naturally.

The configured model is `gpt-realtime-2.1`. The server endpoint is `/api/realtime/token`; the frontend never receives the permanent API key. Realtime diagnostics distinguish microphone, token, WebRTC, and provider failures during a demo.

## How safety works

Every request is evaluated by deterministic backend policy code. Low-risk reads are audited and returned. Medium-risk settings require an approval sheet. High-risk settings additionally require a real WebAuthn assertion created by the device authenticator. The backend verifies the signed assertion, checks the pending action and execution token, executes the permitted tool, and writes an append-only audit record.

The biometric step does not transmit fingerprint or face data to Voges. The browser and operating system perform local user verification and return only a cryptographic assertion.
