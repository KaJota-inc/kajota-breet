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

Script:
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
