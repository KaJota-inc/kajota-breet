# Hackathon credentials & branches — kajota (mobile)

One section per active hackathon target on this repo. Each section
pins:

- the dedicated branch
- where local secrets live (gitignored)
- which `.env.<hack>.example` template seeds local config
- the human-side credential-mint steps

Branches use the `hackathon/<id>` convention to match the existing
`hackathon/coach` / `hackathon/coach-agent-v2` branches across the
KaJota repos.

---

## Breet Builder Grant (Jun 15, 2026 deadline)

| | |
|---|---|
| **Branch** | `hackathon/breet` |
| **Application URL** | https://africatechnologyexpo.com/breet |
| **Local env** | `.env.breet` (gitignored; template `.env.breet.example`) |
| **Secret store** | `secrets/breet/` (gitignored; `.gitkeep` keeps the dir) |
| **API docs** | https://breet.io/crypto-stablecoin-api · https://breet.io/developers |
| **Backend integration** | kajota-mobile-backend's matching `hackathon/breet` branch (TBD) |
| **Status** | Authorized Jun 10, 2026 — highest-ROI hack on the board |

### Why this hack

- $5,000 equity-free cash grant per winner, two winners ($10k pool)
- KaJota profile matches every eligibility line: Nigerian fintech, live
  product, KYC/KYB ready, growth-stage, NGNT-native
- Application surface is small: business info + 2-min Loom showing
  Breet's API integrated and working
- Competitive pool is shallow (Africa-focused fintechs vs. global
  hackathon entries)

### Submission timeline

| Date | Milestone |
|---|---|
| **Jun 15, 2026** | Application + Loom video deadline |
| **Jun 18, 2026** | Top 5 shortlist announced |
| **Jun 27, 2026** | Live pitches at Africa Technology Expo, Lagos |

### What Breet's API actually offers

Three primary endpoints — keep this small surface in mind when
designing the integration:

1. **Generate per-user wallet address** — POST to Breet, get a
   crypto address (BTC / ETH / TRON / USDT-TRC20 / USDC-ERC20 / etc.)
2. **Webhook for inbound payment** — Breet calls your backend with a
   signed payload when crypto lands at any address you generated.
3. **Settlement** — Breet auto-converts inbound crypto to your chosen
   currency (NGN / USDC / USDT / GHS).

Supported coins: BTC, ETH, BNB, SOL, TRX, BCH, XRP, USDT, USDC,
AVAX, LTC, TON, DOGE. Fees: 0.5%.

### Three integration paths (all on the table per `BREET_INTEGRATION_TARGET`)

For the Loom recording, ONE clean integration is enough. We scaffold
all three so the fastest-shipping one wins.

#### Path A — Wallet deposit (recommended, easiest fit)

KaJota's `FundWallet` screen today funds via Stripe (card). Add a
"Pay with crypto" option:

1. User taps "Fund Wallet" → "Pay with crypto"
2. Mobile calls KaJota backend → backend calls Breet
   `POST /addresses` with the user's Breet customer id
3. Backend returns a crypto address (or several, one per coin) to mobile
4. Mobile shows QR + address; user pays from any wallet
5. Breet detects + auto-converts → posts signed webhook to KaJota
   backend's `/webhooks/breet/deposit`
6. Backend credits the user's KaJota wallet for the settlement amount

**Files to touch (mobile):**
- `src/pages/Accounts/FundWallet/index.tsx` — add crypto-option tile
- `src/pages/Accounts/FundWallet/BreetDepositModal.tsx` *(new)* — QR + address + status polling
- `src/services/breet/client.ts` *(new)* — typed wrapper for the
  backend's Breet-proxy endpoints

**Files to touch (backend, on kajota-mobile-backend `hackathon/breet`):**
- New `/breet/customer` endpoint (create on first use, idempotent)
- New `/breet/deposit-address` endpoint
- New `/webhooks/breet/deposit` endpoint (verify signature, credit
  wallet)

#### Path B — Order payment (stablecoin checkout)

`OrderPayment` screen today checks out via Stripe. Add a stablecoin
tile in `PaymentOptionModal.tsx`:

1. User taps "Pay with USDC" at checkout
2. Mobile → backend → Breet `POST /addresses` with order metadata
3. Mobile shows address + amount + countdown
4. Breet detects → backend marks order paid → mobile transitions to
   confirmation

Reuses the same Breet API surface — just a different trigger. The
deposit code from Path A is mostly portable.

**Files to touch (mobile):**
- `src/pages/Home/OrderPayment/PaymentOptionModal.tsx` — add tile
- `src/pages/Home/OrderPayment/BreetPaymentModal.tsx` *(new)* — same
  QR + status pattern as Path A
- `src/services/breet/client.ts` *(shared with Path A)*

#### Path C — Withdraw (off-ramp)

`WithdrawAmount` today withdraws to bank. Breet's primary surface is
INBOUND (receive crypto + settle to fiat). Off-ramp (NGN → crypto
sent out) needs confirmation from their docs / dev support — they
may or may not expose a send-out API in the Builder Grant tier.

**Status:** verify with Breet team before committing. If supported,
the flow mirrors Path A in reverse (mobile triggers → backend calls
Breet to send → confirm via webhook).

### Loom recording plan (~2 minutes)

Per the Builder Grant requirements:

1. **(0:00–0:15)** Intro: "KaJota — Nigerian e-commerce wallet" with
   the existing UI shown
2. **(0:15–0:30)** Show the new "Pay with crypto" tile in FundWallet
3. **(0:30–1:00)** Tap through → QR + address visible
4. **(1:00–1:30)** Send a small test USDT (TRC-20) from another wallet
5. **(1:30–1:50)** Webhook lands → wallet balance updates in real time
6. **(1:50–2:00)** Outro: "Breet API integrated — one-tap stablecoin
   on-ramp for African users"

### Credentials to mint

1. **Breet developer account.** Sign up at
   <https://breet.io/developers> using KaJota's business email.
2. **Business verification (KYB).** Upload incorporation + KYC
   documents. Breet asks for this; mention the Builder Grant
   application to fast-track.
3. **API key + webhook secret.** Generated in the developer
   dashboard. Set as `BREET_API_KEY` + `BREET_WEBHOOK_SECRET` in
   `.env.breet`.
4. **Webhook tunnel for local dev.** `ngrok http 4000` against the
   `kajota-mobile-backend` `hackathon/breet` branch's webhook
   endpoint, or use Cloudflare Tunnel for a stable URL.

### Application form requirements (per Breet's site)

The form requests:
- Business name + website URL
- Industry classification
- Company stage (growth-stage required)
- Incorporation/registration confirmation
- "Your unique code" for Breet API access (i.e., your API key)
- 2-minute Loom video showing Breet's API integrated and working

No pitch deck, no business plan, no formal investor docs.

### TODO before the Jun 15 submission

- [ ] Sign up for Breet developer account
- [ ] Complete KYB (business verification)
- [ ] Provision API key + webhook secret → `.env.breet`
- [ ] Stand up the Breet proxy on
      `kajota-mobile-backend` `hackathon/breet` branch (`/breet/*` +
      `/webhooks/breet/deposit`)
- [ ] Wire `FundWallet` → `BreetDepositModal` (Path A)
- [ ] First successful test deposit → confirm webhook landed +
      wallet credited
- [ ] Record 2-min Loom following the plan above
- [ ] Submit Devpost-style form on
      africatechnologyexpo.com/breet

### Submission tracking

| | |
|---|---|
| Application submitted | _( fill once submitted )_ |
| Loom video URL | _( fill once recorded )_ |
| Shortlist notification | _( Jun 18 expected )_ |
| Pitch slot at ATE Lagos | _( Jun 27 if shortlisted )_ |

---

## Concierge

Existing branch — see commits on `hackathon/concierge` for the build.
Demo prep deferred to a separate session.

---

## KaJota Escrow / ETHGlobal NY 2026 (Jun 12–14, 2026)

Existing branch — see `hackathon/escrow`. Decision pending on
whether to apply.

---

## Adding a new hackathon

1. Cut the branch off `dev`: `git checkout -b hackathon/<id> dev`.
2. Copy `.env.breet.example` → `.env.<id>.example` and adjust.
3. `mkdir -p secrets/<id> && touch secrets/<id>/.gitkeep`.
4. Add a new top-level section to this file mirroring the structure
   above.
5. The repo `.gitignore` already covers `.env.<anything>` (with
   `.env.<anything>.example` re-included) and `secrets/<hack>/*`
   (with `.gitkeep` re-included).
