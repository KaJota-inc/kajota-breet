# Breet Builder Grant 2026 — submission

Reference content to paste into the application form at
<https://africatechnologyexpo.com/breet>. Adjust to match the form's
current field set; this doc captures the answers worth pinning so a
second drafter doesn't have to re-derive them.

---

## Business

**Business name:** KaJota

**Website:** [insert KaJota production URL]

**Industry:** Fintech / E-commerce / Wallet

**Company stage:** Growth-stage. Live product in market with active
users transacting in NGN via Stripe-backed wallet flows.

**Incorporation:** [insert registration jurisdiction + number]

**Compliance:** KYC + KYB workflows live in production (biometric +
PIN gating on critical money moves; document-verification on
onboarding). Compatible with Breet's KYC/KYB Partners requirement.

---

## Breet API integration

**Public repo:** <https://github.com/KaJota-inc/kajota-breet>

**What we integrated**

A "Pay with crypto" tile added to the KaJota wallet's FundWallet
screen. Tapping it routes through KaJota's backend, which uses
Breet's API to:

1. **Generate** a fresh per-user deposit address (USDT-TRC20 by
   default; UI toggle for USDC-ERC20, BTC, etc. across Breet's 12+
   supported coins).
2. **Display** the address + QR + amount + status to the user, with
   a copy-button and live polling.
3. **Detect** inbound payment via Breet's signed webhook posted to
   `POST /api/v1/webhooks/breet/deposit`.
4. **Verify** the webhook's `X-Breet-Signature` header using
   HMAC-SHA256 with constant-time compare against the
   `BREET_WEBHOOK_SECRET`.
5. **Settle** to NGN (or USDC / USDT / GHS — configurable per
   environment) and credit the user's KaJota wallet balance the
   moment Breet's status reaches `settled`.

**Why this matters for Nigerian users**

KaJota's wallet currently funds via Stripe card. Card penetration in
the target market is uneven; chargeback rates are high; FX cost is
opaque. Breet's stablecoin on-ramp routes around all three:
diaspora-held USDT lands in the user's NGN balance in seconds with a
fee floor at 0.5% and zero chargeback risk.

The integration is the first of three planned paths — Path A
(wallet deposit) shipped this submission; Path B
(stablecoin checkout in OrderPayment) and Path C (off-ramp
withdrawal) reuse the same plumbing.

---

## Architecture (1-paragraph)

Mobile (React Native) → KaJota backend (Spring Boot) → Breet API.
The Breet API key never reaches the mobile client; the backend is
the only place that holds it. Webhook delivery from Breet posts
back to the backend with HMAC-signed payloads, verified
byte-exactly before any wallet credit lands. The integration is
profile-gated so the in-memory stub runs in simulator builds and
the real HTTP client runs in production — both wear the same
`BreetService` interface so toggling environments is a one-line
config change.

---

## Demo video (Loom)

[insert Loom URL — 2 minutes maximum]

Three scripts below.

- **A — real crypto path.** Highest fidelity; needs the Breet unique
  code in hand and a real testnet deposit. Mobile sim drives the
  whole flow.
- **B — stub-mode mobile.** Mobile sim drives the flow, but the
  backend is `backend-demo` (no Breet credentials) and the webhook is
  curl-fired with HMAC computed inline. Same code on both sides of
  the wire — only Breet's upstream is swapped.
- **C — code-walkthrough (no mobile sim).** Demo runs entirely in
  IDE + terminal: `backend-demo` boots live on `:9082`, real curl
  fires real HMAC-signed webhooks, tests pass green on screen. Mobile
  side is shown via the source files (`BreetDepositModal.tsx` is the
  UI spec). Use this when the mobile dev environment can't be brought
  up in time (e.g. branch on an older Expo SDK than your installed
  dev-client).

### A — real crypto path (preferred, needs Breet credentials)

1. **0:00–0:15** KaJota app open on FundWallet, existing Stripe rail
   visible (existing surface).
2. **0:15–0:30** Tap the new **"Pay with crypto"** tile. Modal
   opens, address generates.
3. **0:30–1:00** Show the deposit address + copy button. Open a
   second wallet on the same device (Trust Wallet / MetaMask),
   paste, send a small test amount of USDT-TRC20.
4. **1:00–1:30** Cut to the modal — webhook lands, polling picks it
   up, status transitions: `awaiting → detected → settled`.
5. **1:30–1:50** Tap Done. KaJota wallet balance reflects the
   credited NGN equivalent.
6. **1:50–2:00** Outro: "Breet's API integrated end-to-end —
   stablecoin on-ramp for African users, no chargebacks, settles in
   seconds."

### B — stub-mode recording recipe (no Breet credentials required)

The backend's `BreetServiceStubImpl` is `@Profile("!prod")` — it
generates fake addresses and records fake settled deposits the moment
a webhook lands. The mobile state machine, the HMAC verifier, and the
wallet-credit code paths are the **same code that runs in prod**;
only the upstream HTTP client is swapped out. This script demonstrates
the full integration without burning real Breet quota.

#### One-time prep (off-camera, before recording)

```sh
# Terminal 1 — standalone Breet demo backend (no Mongo/AWS/Stripe needed)
cd backend-demo && BREET_WEBHOOK_SECRET="demo-secret-do-not-use-in-prod" ./mvnw spring-boot:run
# → boots in ~0.8 seconds on :9082, stub service always active

# Terminal 2 — mobile in Expo simulator
cd mobile && npx expo start --ios
```

`backend-demo/` is a standalone Spring Boot app that mirrors the
production Breet controllers + stub service + HMAC verifier, with
none of the production backend's Mongo / AWS / Stripe dependencies.
Same classes — `BreetController`, `BreetWebhookController`,
`BreetServiceStubImpl`, `BreetSignatureVerifier` — boot in under a
second, no env-var hunt.

Have Loom desktop ready in **Screen + Cam** mode with a script-time
buffer of ~2 min, 1080p.

#### Scene-by-scene (target 2:00 total)

| Time | Window | What happens | Voiceover |
|---|---|---|---|
| **0:00–0:10** | Simulator | Open KaJota → FundWallet screen. Card-funding tile visible. | "KaJota is a Nigerian e-commerce wallet. Today, users fund with Stripe — fine for diaspora, friction for everyone else." |
| **0:10–0:25** | Simulator | Tap the new **Pay with crypto** tile. Modal opens, spinner → fresh `STUB...` address appears with copy button + amount + status pill (`awaiting`). | "We added a Breet-powered stablecoin on-ramp. One tap and the user gets a per-deposit address. The mobile never touches Breet's API key — the backend proxies." |
| **0:25–0:50** | IDE / split-pane | Briefly show `services/breet/useBreetDeposit.ts` — highlight the state machine (`awaiting → detected → settled → expired`). Then show `BreetSignatureVerifier.java` — highlight `MessageDigest.isEqual` constant-time compare. | "The state machine is extracted into a pure async core so the lifecycle is testable without a renderer. Webhook auth is HMAC-SHA256, constant-time compared — no timing leaks." |
| **0:50–1:20** | Terminal 3 | Fire the simulated Breet webhook with a valid signature. Modal in simulator updates **live**: `awaiting → detected → settled`. | "I'll simulate Breet's webhook with curl. Note the signature header — same HMAC the controller will verify." |
| **1:20–1:35** | Simulator | Settled state shows amount, NGN equivalent, tx hash. Tap Done. FundWallet shows wallet balance ticked up. | "Mobile polls, the stub returns the settled deposit, wallet credits. Same code path that runs in prod against the real Breet API." |
| **1:35–1:55** | Terminal | Run `npx jest mobile/services/breet` (13/13 green) and `mvn -pl backend test -Dtest=BreetSignatureVerifierTest` (9/9 green). | "Thirteen mobile tests on the state machine plus client. Nine backend tests on the signature verifier including RFC 4231 vector one. Both pass clean." |
| **1:55–2:00** | Outro card | `github.com/KaJota-inc/kajota-breet` + KaJota logo. | "KaJota × Breet. Stablecoin on-ramp for African users, end-to-end." |

#### The curl one-liner (Terminal 3)

The webhook controller verifies the HMAC against the **raw** body
bytes. Computing the signature inline keeps the demo clean:

```sh
SECRET="demo-secret-do-not-use-in-prod"
ADDR_ID="<paste the addressId surfaced in the modal>"
PAYLOAD='{"event":"deposit.settled","addressId":"'"$ADDR_ID"'","coin":"USDT-TRC20","amountCrypto":"50.00","amountSettled":"82500.00","settlementCurrency":"NGN","txHash":"0xstubdemo","reference":"order-loom-demo","detectedAt":1781544000000}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -X POST http://localhost:9082/api/v1/webhooks/breet/deposit \
  -H "Content-Type: application/json" \
  -H "X-Breet-Signature: $SIG" \
  --data-raw "$PAYLOAD"
```

Returns `200 OK`. Mobile poll picks it up on the next tick.

`detectedAt` is **epoch milliseconds (Long)**, not ISO string — Jackson
returns 400 on string formats. Verified end-to-end against
`backend-demo` during the dry-run.

#### Recording tips

- **Do a dry run first** so you know exactly where each tap lands and the curl one-liner doesn't fumble live.
- **Speak to the integration**, not the slideware — the grant rewards real code shipping against the real API. Calling out the stub-mode swap explicitly is a feature, not a hedge.
- **Voiceover in post** beats live narration if you fluff a take — Loom's edit panel can re-cut.
- **Keep the camera bubble small** (bottom-right) so the simulator screen stays the focus.
- **Caption the URL** in the outro frame so judges can copy the repo without scrubbing.

### C — code-walkthrough recipe (no mobile sim needed)

The full integration is provable end-to-end without booting the
React Native app. `backend-demo` runs the exact same controllers +
service + HMAC verifier that ship in the production hackathon/breet
branch, in under a second. The mobile UI is fully visible as source:
`BreetDepositModal.tsx` IS the spec for what the user sees, and the
13/13 jest tests on `useBreetDeposit.ts` prove the state machine
behaves correctly without needing to render it.

Reach for this when the mobile dev environment can't be brought up
in time — e.g. the hackathon branch is on Expo SDK 49 but your
installed dev-client was built from a SDK 53 branch (native module
ABI mismatch), or you don't have time to do a fresh `expo run:ios` /
`expo run:android` build.

#### One-time prep (off-camera)

```sh
# Terminal 1 — backend-demo live
cd backend-demo && BREET_WEBHOOK_SECRET="demo-secret-do-not-use-in-prod" ./mvnw spring-boot:run

# IDE — open kajota-breet repo, have these tabs ready (Cmd+P targets):
#   mobile/BreetDepositModal.tsx                ← UI spec
#   mobile/services/breet/useBreetDeposit.ts    ← state machine
#   mobile/services/breet/client.ts             ← HTTP client
#   backend-demo/.../util/breet/BreetSignatureVerifier.java  ← HMAC verifier
#   backend-demo/.../controller/breet/BreetWebhookController.java  ← raw-bytes verify-then-credit
#   backend-demo/.../service/breet/BreetServiceStubImpl.java  ← stub impl
```

#### Scene-by-scene (target ~2:00 total)

| Time | Window | What happens | Voiceover |
|---|---|---|---|
| **0:00–0:10** | Browser / repo README | Show the [kajota-breet GitHub repo README](https://github.com/KaJota-inc/kajota-breet). Hover the architecture diagram. | "KaJota is a Nigerian e-commerce wallet. We added a Breet-powered stablecoin on-ramp so users can fund their NGN wallet with USDT/USDC. Mobile + Spring Boot backend, both in this repo." |
| **0:10–0:30** | IDE — `BreetDepositModal.tsx` | Scroll through the modal source. Highlight the status pill states (`awaiting / detected / settled / expired`) and the address + copy button. | "This is the modal. The user taps Pay with crypto in FundWallet, it generates an address via our backend, polls for settlement, transitions through these four states." |
| **0:30–0:50** | IDE — `useBreetDeposit.ts` | Highlight `runBreetDeposit` (pure async core extracted from the hook for testability). Show the state-machine transitions. | "The lifecycle's in a pure async function, not buried in a React hook. Means we can test the state machine without a renderer — thirteen jest tests cover it." |
| **0:50–1:10** | Terminal — `npx jest mobile/services/breet` | Run jest from a clone of the repo. Show the 13/13 pass. | "Cache hits, transient errors, cancellation, expiration — all green." |
| **1:10–1:30** | IDE — `BreetSignatureVerifier.java` | Highlight `MessageDigest.isEqual` (constant-time compare). Switch to `BreetWebhookController.java`, highlight `@RequestBody byte[] rawBody` (raw bytes, not Jackson-deserialised — so we sign over what Breet signed). | "Webhook auth is HMAC-SHA256, constant-time compared — no timing leaks. The controller reads raw bytes, not parsed JSON, so the signature is over exactly what Breet signed." |
| **1:30–1:50** | Terminal — backend-demo live + curl | One window: `backend-demo` log streaming. Other window: fire the SUBMISSION.md curl one-liner. Show backend log line `breet stub: webhook recorded settled deposit`. Run `mvn test -Dtest=BreetSignatureVerifierTest`, show 9/9. Run the same curl with a tampered payload, show `401`. | "Backend's live on :9082. Real curl, real HMAC, real 200 OK. Nine RFC 4231 verifier tests pass. Tamper the payload and the verifier rejects — 401, exactly the path that would block a forged webhook in production." |
| **1:50–2:00** | Outro card | `github.com/KaJota-inc/kajota-breet` + KaJota logo. | "KaJota × Breet. Stablecoin on-ramp for African users, end-to-end. Code is on GitHub — clone and run the tests yourself." |

#### Why this version is fine for grant judging

Grants reward **demonstrably real integration code** that a judge can
clone and run. Script C gives them:

- Working `backend-demo` they can boot in under a second
- HMAC-signed webhook they can hit with curl from the README
- 22 tests they can run locally and watch pass
- All the source files they'd want to inspect

A live mobile UI is icing — useful, but not the load-bearing part of
"this integration is real."

---

## Test coverage

- **Mobile**: 13/13 jest tests covering the state machine + HTTP
  client (cache hit, fetch + unseal, transient errors, cancellation,
  timeout / expiration).
- **Backend**: 9 JUnit tests covering the HMAC-SHA256 signature
  verifier including RFC 4231 vector #1 round-trip + tamper
  detection + null-input guards.

Both suites are runnable via standard tooling
(`npx jest mobile/services/breet` / `mvn test`) — clone the public
repo and verify.

---

## Team

[insert team info — names, roles, contact for ATE judging team]

---

## What we'd do with the $5k

[insert intended use of grant — e.g. extend to Path B/C, cover the
mainnet API quota for the first N users, accelerate the off-ramp
withdrawal flow]

---

## Contact

[insert primary contact email + WhatsApp / Slack handle for the
build phase support Breet offers shortlisted finalists]
