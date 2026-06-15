# kajota-breet

**KaJota × Breet** — stablecoin & crypto on-ramp for African users, integrated into the KaJota wallet via [Breet](https://breet.io)'s payment API.

Submission to the [Africa Technology Expo · Breet Builder Grant 2026](https://africatechnologyexpo.com/breet) (deadline Jun 15, 2026).

---

## What this is

KaJota is an e-commerce + wallet app targeting African merchants. Today, wallet funding goes through Stripe (card). This integration adds **"Pay with crypto"** — a tap-to-fund flow where the user receives a Breet-managed deposit address (USDT, USDC, BTC, …) and the wallet is credited in NGN/GHS/USDC the moment Breet's webhook confirms settlement.

The grant is awarded for builders showing live, demonstrable use of Breet's API. This repo carries the integration code in two halves:

- **`mobile/`** — React Native / TypeScript. The deposit modal + the state-machine hook + the typed HTTP client.
- **`backend/`** — Spring Boot / Java. REST proxy over Breet's API + signed webhook receiver with constant-time HMAC verification.

Production source is in two private KaJota repositories (`KaJota-inc/kajota` for the mobile app, `KaJota-inc/mobile-backend` for the Spring Boot service). The hackathon branches are `hackathon/breet` in both. This repo is the **extracted integration surface** — the files actually touched by the Breet wiring, lifted out of the production codebases for review.

## Architecture

```
+-----------------------+        +---------------------------+        +----------------+
|   KaJota mobile (RN)  |        |   KaJota backend (Spring) |        |   Breet API    |
|                       |        |                           |        |                |
|  FundWallet screen    | POST   |  /api/v1/breet/           | HTTP   |  /addresses    |
|   "Pay with crypto" --+------> |    deposit-address        +------> |                |
|                       |        |                           |        |                |
|  BreetDepositModal    | GET    |  /api/v1/breet/           |        |                |
|  (polls for status) <-+------- |    deposit-address/{id}   |        |                |
|                       | 200/   |                           |        |                |
|                       | 404    |                           |        |                |
|                       |        |                           | POST   |                |
|                       |        |  /api/v1/webhooks/breet/  | <------+ X-Breet-Sig    |
|                       |        |    deposit                |        | (HMAC-SHA256)  |
|                       |        |   ^ HMAC verify           |        |                |
|                       |        |   v credit wallet         |        |                |
+-----------------------+        +---------------------------+        +----------------+
```

The mobile never holds Breet's API key — it talks only to KaJota's backend, which proxies to Breet with the secret server-side.

## Mobile side (`mobile/`)

```
mobile/
├── BreetDepositModal.tsx        Full modal: address + copy + status polling + terminal states
└── services/breet/
    ├── types.ts                 DTOs (DepositAddress, Deposit, CreateAddressInput)
    ├── client.ts                HttpBreetClient — talks to backend's /breet/* proxy
    ├── client.test.ts           6 tests · POST shape, 404→null, URL encoding
    ├── useBreetDeposit.ts       runBreetDeposit pure async core + React hook
    │                            State machine: idle → creating → awaiting
    │                                                  → (detected) → settled / expired / error
    └── useBreetDeposit.test.ts  7 tests · lifecycle, transient blip, cancel, expire
```

**13/13 mobile tests pass** under jest (`npx jest mobile/services/breet`).

The state machine in `useBreetDeposit.ts` is the heart of the UX — extracted from the React hook into a pure async function (`runBreetDeposit`) so the lifecycle is testable without a renderer. The hook is a thin wrapper.

## Backend side (`backend/`)

```
backend/src/main/java/com/kajota/kajota_mobile_backend/
├── controller/breet/
│   ├── BreetController.java          POST /deposit-address, GET /deposit-address/{id}
│   └── BreetWebhookController.java   POST /webhooks/breet/deposit (HMAC-verified)
├── service/breet/
│   ├── BreetService.java             Facade interface
│   └── BreetServiceStubImpl.java     In-memory stub @Profile("!prod") for dev/sim
├── util/breet/
│   └── BreetSignatureVerifier.java   HMAC-SHA256 with MessageDigest.isEqual
│                                     (constant-time compare against timing leaks)
└── model/dto/
    ├── request/breet/                BreetCreateAddressRequest, BreetWebhookPayload
    └── response/breet/               BreetAddressResponse, BreetDepositResponse

backend/src/test/java/.../util/breet/
└── BreetSignatureVerifierTest.java   9 tests · RFC 4231 vector #1 + tamper detection
                                       + null/malformed input + hex round-trip
```

### Webhook auth model

Mobile callers authenticate with JWT. Breet does NOT send a JWT — they sign the raw body with HMAC-SHA256 keyed by a shared secret (`BREET_WEBHOOK_SECRET`) and post the hex digest in `X-Breet-Signature`. The webhook controller reads the body as raw `byte[]` (not Spring-deserialised) so the bytes we sign over match the bytes Breet signed.

Production wires Spring Security to exempt `/api/v1/webhooks/breet/**` from JWT auth — the HMAC + the IP allowlist on the Render service are the auth.

### Service stub

`BreetServiceStubImpl` is in-memory + `@Profile("!prod")`. It generates fake addresses + records fake settled deposits when a webhook lands, so the full end-to-end demo runs in the simulator without burning real Breet API quota or staging real test deposits. Production wires a `BreetServiceHttpImpl` (next session — once the API key is in hand) that calls Breet's actual endpoints.

## Environment template

See `.env.breet.example`. The integration needs:

```sh
BREET_API_KEY=                # from breet.io/developers
BREET_WEBHOOK_SECRET=         # from the same dashboard
BREET_API_BASE=https://api.breet.io
BREET_SETTLEMENT_CURRENCY=NGN
BREET_WEBHOOK_URL=            # public URL the backend exposes /webhooks/breet/deposit at
```

## Demo flow

1. User opens FundWallet in the KaJota app
2. Taps the **"Pay with crypto"** tile (new)
3. Modal opens → backend `POST /breet/deposit-address` → returns a fresh USDT-TRC20 address
4. Modal shows the address with a copy button (QR rendering — TODO: install `react-native-qrcode-svg`)
5. User sends crypto from any wallet
6. Breet detects + auto-settles → posts signed webhook to backend
7. Backend HMAC-verifies → records the deposit → credits the user's wallet
8. Mobile poll picks up the new `settled` deposit → modal flips to success
9. User taps Done → wallet balance reflects the credit

## Detailed walkthrough

For the credential-mint checklist (Breet developer signup, KYB, API key, webhook tunnel setup) and the Loom recording script, see [`HACKS-original.md`](./HACKS-original.md) — an extract from the production repo's full hackathon notes.

## License

MIT — see [LICENSE](./LICENSE).

## Authors

KaJota Inc. — [github.com/KaJota-inc](https://github.com/KaJota-inc)
