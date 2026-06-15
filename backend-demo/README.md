# backend-demo

Standalone Spring Boot 2.7 app that boots the **KaJota × Breet**
integration end-to-end without any of the production backend's
Mongo / AWS / Stripe / OAuth dependencies.

All Java sources under
`src/main/java/com/kajota/kajota_mobile_backend/controller/breet`,
`service/breet`, `util/breet`, and `model/dto/.../breet` are **mirrored
from the production `kajota-mobile-backend` repo's `hackathon/breet`
branch** — same package paths, same class names — so this app proves
the live demo runs the production wiring, not a separate fork.

The only intentional divergences:

- `BreetServiceStubImpl` drops `@Profile("!prod")` (this app has no
  notion of profiles — the stub is always active)
- `BreetController` takes `@RequestHeader("X-User-Id")` instead of
  `@AuthenticationPrincipal Jwt`, so the demo doesn't need the OAuth2
  resource server library

## Run

```sh
cd backend-demo
BREET_WEBHOOK_SECRET="demo-secret-do-not-use-in-prod" ./mvnw spring-boot:run
```

Boots in ~0.8 seconds. Tomcat listens on **:9082**.

> Use `./mvnw` not system `mvn` — Maven 3.9.9 has a known
> Lombok / JDK 21 conflict that hangs annotation processing; the
> bundled wrapper uses 3.9.7.

## Smoke-test it

```sh
# 1. Create a stub deposit address (mobile-side call shape)
curl -s -X POST http://localhost:9082/api/v1/breet/deposit-address \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: demo-user' \
  -d '{"coin":"USDT-TRC20","amountExpected":"50.00","reference":"order-loom-demo"}'

# 2. Webhook (HMAC-signed) — see SUBMISSION.md for the curl one-liner
# 3. Poll the address: GET /api/v1/breet/deposit-address/{id} returns
#    the settled deposit once the webhook lands
```

## Tests

```sh
./mvnw test -Dtest=BreetSignatureVerifierTest
```

9/9 green — RFC 4231 vector #1, tamper detection, null-input guards.

## License

MIT — see [`../LICENSE`](../LICENSE).
