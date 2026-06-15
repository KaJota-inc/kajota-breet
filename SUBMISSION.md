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

Two scripts below. **Pick A if you have the Breet unique code in
hand** (real testnet deposit). **Pick B if recording before Breet
provisions credentials** — the integration runs end-to-end against
the in-memory stub with a curl-fired webhook standing in for Breet's
delivery.

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
# Terminal 1 — backend in dev profile (non-prod → stub impl active)
export BREET_WEBHOOK_SECRET="demo-secret-do-not-use-in-prod"
cd backend && SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Terminal 2 — mobile in Expo simulator
cd mobile && npx expo start --ios
```

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
PAYLOAD='{"addressId":"'"$ADDR_ID"'","coin":"USDT","amountCrypto":"50.00","amountSettled":"82500.00","settlementCurrency":"NGN","txHash":"0xstubdemo","detectedAt":"2026-06-15T12:00:00Z"}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -X POST http://localhost:9082/api/v1/webhooks/breet/deposit \
  -H "Content-Type: application/json" \
  -H "X-Breet-Signature: $SIG" \
  --data-raw "$PAYLOAD"
```

Returns `200 OK`. Mobile poll picks it up on the next tick.

#### Recording tips

- **Do a dry run first** so you know exactly where each tap lands and the curl one-liner doesn't fumble live.
- **Speak to the integration**, not the slideware — the grant rewards real code shipping against the real API. Calling out the stub-mode swap explicitly is a feature, not a hedge.
- **Voiceover in post** beats live narration if you fluff a take — Loom's edit panel can re-cut.
- **Keep the camera bubble small** (bottom-right) so the simulator screen stays the focus.
- **Caption the URL** in the outro frame so judges can copy the repo without scrubbing.

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
