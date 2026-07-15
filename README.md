# Voges

Voges now has two public surfaces:

- `/` is the product landing page with an accurate capability overview.
- `/app` is the working voice-first financial concierge.

## Public voice preview protection

Owner-funded Realtime access is limited to one 90-second preview per public IP address. The Pages Function stores only a salted SHA-256 identity hash in Cloudflare D1; it never stores the raw IP in the access-gate table. The first successful ephemeral-token issuance permanently consumes that network's preview, while the landing page and banking showcase remain accessible.

This anonymous network gate also applies across devices on the same public network. It cannot reliably identify the same person after they move to another IP address or VPN; account authentication would be required for that stronger guarantee.

Apply the migration before deployment:

```powershell
npm.cmd run d1:gate:local
npm.cmd run d1:gate:remote
```

For an intentional demo reset of every preview record:

```sql
DELETE FROM realtime_access_limits;
```

Set `REALTIME_GATE_SECRET` as a long random Cloudflare Pages secret. If omitted, the gate uses `EXECUTION_TOKEN_SECRET` as its server-only salt.

Voges is a voice-first AI financial concierge prototype. It combines natural realtime conversation with deterministic banking tools, backend policy, visible approval, real WebAuthn passkeys, D1 state changes, and an auditable security trail.

The core product principle is:

> Voice is the primary interface. The screen is the safety layer.

Voges is a portfolio and architecture prototype built with a workspace sample banking dataset. It is not an official bank product and does not connect to a live core-banking system.

## Quick start

```bash
npm install
npm run d1:seed:local
npm run d1:v3:local
npm run d1:history:local
npm run dev
```

Open `http://localhost:5173`. Use `npm run dev:ui` only for frontend styling; API, D1, voice token minting, actions, and passkeys require the full Pages development server.

Before committing or deploying, run the complete verification suite:

```bash
npm run verify
```

This command runs type checking, automated tests, the Vite production build, and a Cloudflare Pages Functions compatibility build.

## What Voges demonstrates

- OpenAI `gpt-realtime-2.1` voice conversation over browser WebRTC.
- Immediate language adaptation to the customer's latest spoken language.
- D1-backed banking reads for profiles, accounts, cards, transactions, KYC, product guidance, and support activity.
- Deterministic tool routing and conversation guidance for vague requests.
- A backend Policy Engine that owns risk and authorization decisions.
- Expiring pending actions and an on-screen approval contract.
- Real WebAuthn registration and authentication using the device platform authenticator.
- Exactly-once write execution with short-lived execution tokens.
- Resolution Autopilot for root-cause analysis, bounded multi-step plans, and payment readiness checks.
- Scam Risk Advisor based on `sample_data/luadao.json.txt` as an advisory knowledge source.
- Session history, structured visual cards, D1 audit events, and a security Trust Center.
- Verified Action Receipts reconstructed from completed D1 actions and audit evidence.
- A Demo Data Room that displays a live, privacy-safe D1 snapshot for portfolio walkthroughs.
- Whole-app display recovery so a React rendering fault does not leave a blank screen.

## Architecture

### Realtime voice

Realtime has two separate phases and they must remain separate:

```text
REST token minting
Browser -> /api/realtime/token -> Cloudflare AI binding / AI Gateway -> OpenAI

Live media transport
Browser microphone -> WebRTC -> OpenAI Realtime
```

The REST endpoint returns a short-lived client secret. The browser then negotiates WebRTC directly with OpenAI. The server never proxies live microphone audio.

`src/realtime-orchestrator.js` is the only module allowed to create model responses. Server VAD detects turns but does not create responses itself. This prevents duplicate active responses.

Read [ARCHITECTURE_GUARDRAILS.md](./ARCHITECTURE_GUARDRAILS.md) before changing any voice file.

### Banking reads

```text
Customer request
  -> GPT tool proposal
  -> deterministic client routing budget
  -> Cloudflare Pages Function
  -> allowlisted Tool Layer
  -> D1 query
  -> structured UI card + natural voice explanation
```

The model does not receive arbitrary SQL access. Every tool name and input shape is allowlisted.

### Sensitive actions

```text
AI proposes
  -> backend validates tool and payload
  -> Policy Engine evaluates current D1 state
  -> expiring pending action
  -> visible customer approval
  -> WebAuthn assertion when required
  -> backend verifies origin, RP ID, signature, counter, and user verification
  -> short-lived execution token
  -> policy re-evaluation
  -> atomic D1 execution lock
  -> state update
  -> append-only application audit event
  -> verified action receipt
  -> voice confirmation
```

The frontend never grants execution authority. It cannot make an action safe by sending fields such as `biometricVerified: true`.

## Verified Action Receipts

After a completed action, Voges builds a privacy-safe receipt from:

- the persisted pending-action contract;
- the backend policy decision;
- confirmation and WebAuthn timestamps;
- allowlisted before/after D1 fields;
- related audit event types;
- the final execution outcome.

The receipt receives a SHA-256 fingerprint as a stable integrity reference. This is not a digital signature or external notarization. Production use would store or sign the receipt through a separate trust service.

Receipts can be reopened from **Security & Evidence -> Verified action receipts** and copied as structured JSON.

## Demo Data Room

The Data Room queries D1 at request time and displays only a masked portfolio snapshot:

- customer risk, KYC, and account status;
- account balances and currencies;
- masked card controls and limits;
- recent transaction status;
- recent support activity;
- action and audit counts.

The endpoint deliberately excludes email, phone, encrypted card data, document numbers, WebAuthn public keys, challenges, IP hashes, and raw audit metadata.

## WebAuthn and passkeys

Voges uses real WebAuthn cryptographic authentication. The application never receives fingerprint images, facial images, device PINs, or raw biometric data. The browser and operating system perform local user verification and return a signed assertion.

Required variables:

```dotenv
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Voges
WEBAUTHN_ORIGIN=http://localhost:5173
EXECUTION_TOKEN_SECRET=<long-random-secret>
```

Production example:

```dotenv
WEBAUTHN_RP_ID=voges.pages.dev
WEBAUTHN_RP_NAME=Voges
WEBAUTHN_ORIGIN=https://voges.pages.dev
```

Passkeys are scoped to the RP ID. A localhost credential must be registered again on the production domain.

## OpenAI and Cloudflare configuration

Required server-side secret:

```dotenv
OPENAI_API_KEY=<server-only-key>
```

Never place this key in React, a `VITE_` variable, `wrangler.toml`, source control, documentation, or a browser request.

`wrangler.toml` must retain the Cloudflare AI binding:

```toml
[ai]
binding = "AI"
```

The production token function uses the binding to reach the configured AI Gateway before returning an ephemeral Realtime client secret. Smart Placement should remain enabled for production and preview deployments.

## Database setup

The source dataset lives in `sample_data/`.

```bash
npm run d1:seed:local
npm run d1:v3:local
npm run d1:history:local
```

Run remote migrations only after confirming the target D1 database:

```bash
npm run d1:seed:remote
npm run d1:v3:remote
npm run d1:history:remote
```

Migration files are additive and live in `migrations/`. Do not delete existing production data to apply a new capability.

## Testing a complete action

1. Open **Security & Evidence**.
2. Set up device authentication if no passkey exists.
3. Ask: `Enable online payments for my card.`
4. Review the exact resource, before/after state, risk, policy reason, and expiration.
5. Confirm and complete the native Windows Hello, Android, or iOS passkey prompt.
6. Confirm the D1-backed card snapshot changes.
7. Open the generated Verified Action Receipt.
8. Check the audit trail for policy, verification, execution, and completion events.

Cancelling the native prompt is not success and does not execute the action.

## Important limitations

- The current build resolves one server-side demo customer because it has no end-user login system.
- The dataset is a sample D1 dataset, not live bank data.
- The audit log is append-only at the application layer; it is not an immutable external ledger.
- A receipt hash is an integrity reference, not a third-party signature.
- Scam Risk Advisor is advisory and must not be described as guaranteed fraud detection.
- Resolution Autopilot never performs a real payment.
- Production rollout requires authenticated customer binding, a real banking integration, centralized observability, formal security review, and compliance controls.

## Project structure

```text
src/                         React voice-first interface
src/realtime.js              Realtime session contracts and error handling
src/realtime-orchestrator.js Single owner of response.create
src/components/              Structured cards, history, recovery, and Data Room
functions/api/               Cloudflare Pages Function routes
functions/_lib/              Banking, policy, actions, WebAuthn, audit, and receipts
shared/                      Shared Realtime and UI schemas
migrations/                  Additive D1 migrations
sample_data/                 Workspace banking dataset and scam knowledge source
tests/                       Node test suite
```

## Deployment

Build and verify first:

```bash
npm run verify
```

Then deploy to the existing Cloudflare Pages project only when intended:

```bash
npx wrangler pages deploy dist --project-name voges --branch main --commit-dirty=true
```

This repository intentionally does not deploy as part of the verification command.
