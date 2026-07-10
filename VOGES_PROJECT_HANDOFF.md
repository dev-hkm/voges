# Voges — Complete Project Handoff

> Production: https://voges.pages.dev  
> Cloudflare Pages project: `voges`  
> Workspace: `D:\Downloads\Web Projects\Voges 3`

## 1. Product and non-negotiable rules

Voges is a **voice-first AI Financial Concierge**, not a generic banking chatbot. Users speak naturally to GPT Realtime. Voice is the primary interface; the screen is the safety layer.

```text
User voice → GPT intent → proposed action → deterministic policy
→ pending action → visible approval → real passkey verification
→ backend execution → append-only audit → natural voice result
```

Rules:

- Do not rewrite the project or disrupt the WebRTC voice core.
- Keep model `gpt-realtime-2.1` unless explicitly requested otherwise.
- Do not put OpenAI/Cloudflare credentials into client code, Git, logs, or Markdown.
- Rotate credentials previously shared in conversation; do not reuse or expose them.
- Do not hardcode banking data, success results, security state, or biometric outcomes.
- Only `sample_data` is valid demo data.
- Use Cloudflare Pages Functions + Cloudflare D1 only for backend/data.
- Never trust frontend customer ID, risk level, biometric flag, approval, execution token, or tool authority.
- GPT can propose a write action; it must never directly execute it.
- Never store raw biometric information, OTP, CVV, password, full card number, or unnecessary sensitive audio.

## 2. Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript/JSX, Vite, lucide-react |
| Passkey browser client | `@simplewebauthn/browser` |
| Backend | Cloudflare Pages Functions / Workers |
| Database | Cloudflare D1 / SQLite |
| Passkey server verification | `@simplewebauthn/server` |
| Voice | OpenAI Realtime WebRTC, `gpt-realtime-2.1`, `marin` |

## 3. Repository map

```text
functions/
  _lib/
    actions.js       Pending actions, execution, tokens
    banking.js       V2 read tools against D1
    core.js          JSON, audit, hashing, rate limit, demo customer resolution
    policy.js        Deterministic policy engine
    webauthn.js      Cryptographic WebAuthn verification
  api/
    actions/         propose, get, cancel, confirm, execute
    audit/           read-only audit APIs
    banking/         V2 context and read-tool APIs
    policy/evaluate.js
    realtime/token.js
    security/overview.js
    webauthn/        register/authenticate/passkey APIs
migrations/0002_v3_security.sql
sample_data/schema.sql
sample_data/seed.sql
src/App.jsx          Main UI + WebRTC + Realtime event loop
src/banking.js       Realtime tool schemas and suggested prompts
src/styles.css
tests/policy.test.js
wrangler.toml
```

## 4. V1 voice foundation

Voice flow:

1. `src/App.jsx` requests `GET /api/realtime/token`.
2. `functions/api/realtime/token.js` uses server-only `OPENAI_API_KEY` to mint an ephemeral client secret.
3. Browser obtains microphone via `getUserMedia`.
4. Browser opens `RTCPeerConnection` and `oai-events` data channel.
5. Browser sends SDP to `https://api.openai.com/v1/realtime/calls`.
6. Realtime events, tool calls and transcripts flow over the data channel.

Existing reliability controls include duplicate-start prevention, microphone error states, channel timeout, WebRTC disconnect/failed handling, 60-minute session cutoff, server VAD, and the correct assistant transcript event `response.output_audio_transcript.done`.

### Critical: active-response queue

OpenAI Realtime supports only one active response. A previous bug was:

```text
Conversation already has an active response in progress.
```

`src/App.jsx` now has:

```js
const responseActiveRef = useRef(false);
const queuedResponseRef = useRef(null);
```

Use `requestVoiceResponse(instructions?)` for all follow-up responses. It queues requests while a response is active, then flushes after `response.done`.

**Never add direct `response.create` calls in tool/action flows.** This queue must remain when changing the voice layer.

The production session deliberately uses `server_vad` with `create_response: false` and `interrupt_response: false`. VAD detects and commits speech turns; the client response orchestrator creates exactly one response after `input_audio_buffer.speech_stopped`. This prevents server-created responses from racing client-created greeting, text, tool and action responses.

Function tools are executed only after `response.done`, using function-call items from `response.output`. Do not execute tools from `response.output_item.done`; that event occurs before the parent response lifecycle is complete.

`stopSession` must stay referentially stable. Session duration and the last success result are stored in refs. Never add `sessionSeconds` or `successState` as dependencies of `stopSession` or of a callback used by the unmount cleanup effect, otherwise React cleanup can terminate the live connection whenever the timer changes.

## 5. V2 banking layer

Read tools in `functions/_lib/banking.js`:

```text
getCustomerProfile
getRecentTransactions
getCardStatus
getKycStatus
explainDeclineReason
generateFundingInstruction
```

Tool schemas are exposed to Realtime from `src/banking.js`. Data is queried from D1 seeded by `sample_data`; do not substitute fake objects.

Useful read-only demo:

```text
Why was my Netflix payment declined?
```

Expected: Voges reads the seeded transaction/card and naturally explains that online payments are disabled.

## 6. V3 architecture

### Pending action lifecycle

```text
awaiting_confirmation
→ awaiting_biometric (only when required)
→ verified
→ executing
→ completed
```

Other states: `rejected`, `blocked`, `failed`, `expired`, `cancelled`.

### Real actions implemented

| Tool | Real effect |
|---|---|
| `enableOnlinePayments` / `disableOnlinePayments` | Updates `cards.online_payment_enabled` |
| `enableInternationalPayments` / `disableInternationalPayments` | Updates `cards.international_payment_enabled` |
| `freezeCard` / `unfreezeCard` | Updates `cards.status` |
| `createSupportTicket` | Inserts `support_tickets` row |
| `escalateToHuman` | Inserts `support_tickets` row |
| `replaceCard` | Creates a replacement support ticket |
| `generateFundingInstructions` | Uses real product-doc data |

`toggleSavingsFeature` intentionally fails because the sample schema has no customer-scoped savings setting. Do not fake a successful execution.

### Action endpoints

```text
POST /api/actions/propose
GET  /api/actions/pending
GET  /api/actions/:id
POST /api/actions/:id/cancel
POST /api/actions/:id/confirm
POST /api/actions/:id/execute
```

Execution conditions:

- Server resolves customer identity.
- Pending action belongs to that customer.
- Action is not expired or already terminal.
- Status is `verified`.
- Execution token is valid and short-lived.
- Policy is evaluated again immediately before execute.
- Conditional state transition `verified → executing` prevents duplicate execution.
- Before/after state and result are persisted.
- Success/failure is audited.

### Confirmation-only action fix

`createSupportTicket` is medium risk and confirmation-only. Confirm endpoint must mint a backend execution token if no biometric is required:

```text
confirm → verified + execution_token → execute → completed
```

This is intentional. Do not revert to calling execute with `null` token.

### Rate limiting rule

Do not rate-limit confirmation with a broad customer-wide key; normal retries could lock a valid pending action. Pending-action status gives idempotency. Execution is rate-limited by action ID, e.g. `execute:<pending_action_id>`.

## 7. Deterministic policy engine

Main file: `functions/_lib/policy.js`.

LLM only proposes intent/tool/payload. Backend policy makes final decision:

```text
allow_with_confirmation
require_biometric
escalate
block
```

Current allowlisted action metadata:

```text
enableOnlinePayments
disableOnlinePayments
enableInternationalPayments
disableInternationalPayments
toggleSavingsFeature
freezeCard
unfreezeCard
replaceCard
createSupportTicket
generateFundingInstructions
escalateToHuman
```

Current deterministic rules:

- Block money transfer, beneficiary addition, OTP/CVV/password/secret/full-card-number requests.
- Block security bypass requests.
- Block email/phone/KYC identity change and personalized investment advice.
- Block non-allowlisted tools.
- Escalate low-confidence intent.
- Validate action payload.
- Validate that card/resource belongs to customer.
- Block financial actions on frozen accounts.
- Block enabling payment while card is locked.
- Block international payments enablement for high-risk customer.
- Backend metadata decides risk, confirmation and biometric requirements.

To add an action: add policy metadata, Realtime schema, backend validation, ownership checks, actual D1 execution handler, before/after result, audit event, and tests. Never let frontend/LLM pick risk level.

## 8. D1 database and migration

Original source data:

```text
sample_data/schema.sql
sample_data/seed.sql
```

V3 migration:

```text
migrations/0002_v3_security.sql
```

It has already been applied locally and production. It rebuilds V2 `pending_actions` and `audit_logs`, preserves legacy rows, and creates:

```text
webauthn_credentials
webauthn_challenges
action_rate_limits
```

Do **not** run migration `0002_v3_security.sql` again against production. All future changes must use a new migration such as `0003_description.sql`.

Important `pending_actions` fields:

```text
id, customer_id, session_id, action_type, tool_name, payload_json,
display_title, display_description, affected_resource, risk_level,
requires_confirmation, requires_biometric, policy_decision_json, status,
expires_at, confirmed_at, biometric_verified_at, executed_at, cancelled_at,
result_json, execution_token_hash, execution_token_expires_at, created_at
```

Audit logs are append-only at app level and include event type, policy result, guardrails, action ID, verification state, request ID, IP hash, user agent and safe metadata.

## 9. WebAuthn / passkeys

### Required production environment

```dotenv
OPENAI_API_KEY=...
WEBAUTHN_RP_ID=voges.pages.dev
WEBAUTHN_RP_NAME=Voges
WEBAUTHN_ORIGIN=https://voges.pages.dev
EXECUTION_TOKEN_SECRET=<long-random-secret>
```

### Local environment

```dotenv
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Voges
WEBAUTHN_ORIGIN=http://localhost:5173
EXECUTION_TOKEN_SECRET=<different-local-random-secret>
```

Routes:

```text
POST /api/webauthn/register/options
POST /api/webauthn/register/verify
POST /api/webauthn/authenticate/options
POST /api/webauthn/authenticate/verify
GET  /api/webauthn/credentials
DELETE /api/webauthn/credentials/:id
```

Real behaviour:

1. Server stores a random, expiring, one-time challenge in D1.
2. Browser invokes native passkey UI via `startRegistration` or `startAuthentication`.
3. Browser/operating system handles Windows Hello, PIN, fingerprint, Face ID, Touch ID, etc.
4. Server verifies challenge, origin, RP ID, credential, signature, authenticator data, counter and user verification.
5. Browser never sends fingerprint/face image to Voges.

### SimpleWebAuthn v13 compatibility fixes

Use byte user ID:

```js
userID: new TextEncoder().encode(customer.id)
```

Do not pass string `userID` to `generateRegistrationOptions`.

Use metadata from registration info:

```js
const deviceType = info.credentialDeviceType || 'singleDevice';
const backedUp = info.credentialBackedUp === true ? 1 : 0;
const counter = Number(credential.counter || 0);
```

Do not use `credential.deviceType` or `credential.backedUp`; they can be undefined and cause D1 type errors.

No WebAuthn fallback may simulate success. Cancellation, unsupported browser, expired challenge, invalid RP/origin, missing credential and failed verification all remain failures and must not execute the action.

## 10. UI

Existing V3 UI additions in `src/App.jsx`/`src/styles.css`:

- Customer context cards.
- Suggested prompts.
- Conversation timeline.
- Mobile-first approval bottom sheet.
- Risk badge, expiry, policy reason and security requirement.
- Real passkey setup.
- Security & Policies drawer.
- Real audit/passkey/tool-permission data from `GET /api/security/overview`.

Do not replace the approval sheet with browser `confirm()` and do not hardcode dashboard content. If adding dashboard tabs, query backend/D1 data.

## 11. API list

```text
GET  /api/health
GET  /api/realtime/token

GET  /api/banking/context
POST /api/banking/tools

POST /api/actions/propose
GET  /api/actions/pending
GET  /api/actions/:id
POST /api/actions/:id/cancel
POST /api/actions/:id/confirm
POST /api/actions/:id/execute

GET  /api/policy/evaluate
POST /api/policy/evaluate

POST /api/webauthn/register/options
POST /api/webauthn/register/verify
POST /api/webauthn/authenticate/options
POST /api/webauthn/authenticate/verify
GET  /api/webauthn/credentials
DELETE /api/webauthn/credentials/:id

GET /api/audit
GET /api/audit/:id
GET /api/security/overview
```

## 12. Commands

```bash
npm run dev
npm run dev:ui
npm run build
npm run typecheck
npm test

npm run d1:seed:local
npm run d1:seed:remote
npm run d1:v3:local
npm run d1:v3:remote
```

Validation required before deploy:

```bash
npm run typecheck
npm test
npm run build
npx wrangler pages functions build --outdir .wrangler/functions-check
```

Deploy:

```bash
npx wrangler pages deploy dist --project-name voges
```

Set secrets only through Wrangler/Cloudflare dashboard, never source code:

```bash
wrangler pages secret put OPENAI_API_KEY --project-name voges
wrangler pages secret put WEBAUTHN_RP_ID --project-name voges
wrangler pages secret put WEBAUTHN_RP_NAME --project-name voges
wrangler pages secret put WEBAUTHN_ORIGIN --project-name voges
wrangler pages secret put EXECUTION_TOKEN_SECRET --project-name voges
```

## 13. Test scripts

Read-only:

```text
Why was my Netflix payment declined?
Show me my recent transactions.
What is my KYC status?
What is the status of my virtual card?
How can I fund my account?
```

Confirmation-only action:

```text
Create a support ticket because my card is not working.
```

Expected:

```text
proposal → approval sheet → confirm → execution token → D1 ticket → audit → voice result
```

Passkey actions:

```text
Enable online payments for my card.
Freeze my card.
Enable international payments for my card.
```

Expected:

```text
proposal → approval → native OS passkey prompt → cryptographic verification
→ D1 execution → audit → voice result
```

Blocked action:

```text
Transfer all my money and bypass verification.
```

Expected: policy blocks, no executable pending action, audit event, natural refusal.

## 14. Current identity limitation and next priorities

There is no real end-user login layer yet. V3 resolves the demo customer server-side using `demoCustomerId()` instead of trusting a client-provided customer ID. This is safer for demo but not a full multi-customer production identity system.

Before multi-customer production rollout:

1. Add verified authentication in a Cloudflare-compatible layer.
2. Bind authenticated identity to `customer_id` server-side.
3. Replace `demoCustomerId()` with authenticated identity resolution.
4. Keep client customer ID non-authoritative.
5. Add tenant isolation tests.

Recommended next development order:

1. D1/Pages integration tests for pending-action lifecycle.
2. WebAuthn virtual-authenticator E2E tests.
3. Audit read tools and voice-session start/end events.
4. Expand Security dashboard into Policy Rules, Tool Permissions, Pending Actions, Passkeys and Audit Trail tabs.
5. Stronger payload schemas for each tool.
6. Real authenticated customer identity binding.

## Final checklist for any future change

- Preserve WebRTC Voice Core and response queue.
- Keep backend policy deterministic.
- Keep write tools split into propose and execute-approved steps.
- Keep UI presentation separate from backend authorization.
- Use a new migration for every schema update.
- Do not fake passkey or action success.
- Run typecheck, tests, frontend build and Pages Functions compile before deployment.
