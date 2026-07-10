# Voges

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

The app uses `gpt-realtime-2.1` and WebRTC. Optional D1, R2, KV, and Queues bindings are documented in `wrangler.toml` for persistence, media exports, session state, and background events.

## V2 banking layer

V2 uses the D1 database bound as `DB`. It imports the existing source-of-truth files in `sample_data/` without generating new data:

- `npm run d1:seed:local` initializes the local D1 database.
- `npm run d1:seed:remote` imports the same schema and seed into the remote `voges-banking` database.

The Pages Function tool layer lives in `functions/_lib/banking.js`. Its read tools query D1; `createSupportTicket` deliberately returns `Action Proposed` and never writes data. Policy, approval, biometric, pending-action, and audit behavior are intentionally deferred to V3.
