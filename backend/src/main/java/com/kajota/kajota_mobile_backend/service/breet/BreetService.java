package com.kajota.kajota_mobile_backend.service.breet;

import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetCreateAddressRequest;
import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetWebhookPayload;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetAddressResponse;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetDepositResponse;

import java.util.Optional;

/**
 * Backend-side facade over the Breet API.
 *
 * <p>The controllers delegate here; the implementation is responsible for
 * calling Breet's actual HTTP API (using the {@code BREET_API_KEY} secret),
 * persisting the address/deposit records in our DB, and routing settlement
 * credits to the user's wallet on webhook receipt.</p>
 *
 * <p>This interface intentionally stays narrow — three methods, one for
 * each public surface the mobile + Breet's outbound webhook hit. The
 * implementation can grow side-tooling (idempotency keys, retry policy,
 * etc.) without leaking it through.</p>
 */
public interface BreetService {

    /**
     * Generate a fresh per-user deposit address via Breet's API and
     * persist the mapping (address id -> user id) locally so the
     * webhook handler can credit the right wallet.
     *
     * @param userId  authenticated user (from the JWT)
     * @param request the create-address payload from the mobile
     * @return the address details the mobile should display
     */
    BreetAddressResponse createDepositAddress(String userId, BreetCreateAddressRequest request);

    /**
     * Look up the latest deposit observed against {@code addressId}.
     * Returns {@code empty} while the address is idle so the controller
     * can return 404 (rather than 200 with an empty body) — the mobile
     * polling treats null as a distinct "nothing yet" signal.
     */
    Optional<BreetDepositResponse> getDeposit(String addressId);

    /**
     * Apply an inbound webhook payload — verify the address belongs to
     * a known user, record the deposit, and credit the user's wallet
     * once the payload status is {@code settled}.
     *
     * <p>Callers MUST verify the HMAC signature BEFORE invoking this
     * method (see {@code BreetWebhookController}).</p>
     */
    void handleWebhook(BreetWebhookPayload payload);
}
