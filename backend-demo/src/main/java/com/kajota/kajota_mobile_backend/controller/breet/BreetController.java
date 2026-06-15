package com.kajota.kajota_mobile_backend.controller.breet;

import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetCreateAddressRequest;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetAddressResponse;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetDepositResponse;
import com.kajota.kajota_mobile_backend.service.breet.BreetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

/**
 * REST surface for the mobile-side Breet integration (Builder Grant hack).
 *
 * <p>The mobile {@code BreetDepositModal} hits exactly two endpoints here:</p>
 * <ul>
 *   <li>{@code POST /breet/deposit-address} — generate a fresh per-user
 *       address via Breet's API and persist the local mapping</li>
 *   <li>{@code GET /breet/deposit-address/{id}} — poll for the latest
 *       deposit observed against the address; returns 404 while idle</li>
 * </ul>
 *
 * <p>The Breet API key never leaves this backend — see
 * {@link BreetService} for the upstream HTTP call.</p>
 *
 * <p>Webhook delivery from Breet lands on a separate controller
 * ({@code BreetWebhookController}) because the auth model differs:
 * the mobile uses JWT bearer auth; Breet uses HMAC signature.</p>
 */
@RestController
@RequestMapping("/api/v1/breet")
@RequiredArgsConstructor
@Slf4j
public class BreetController {

    private final BreetService breetService;

    /**
     * Generate a fresh deposit address for the authenticated user.
     *
     * <p>User identity arrives via {@code X-User-Id} header, set by the
     * existing JWT auth filter in the main backend (the filter writes the
     * subject claim into this header before the request reaches the
     * controller). Keeping this controller dependency-free of the JWT
     * resource server library means the Builder Grant branch builds
     * against the existing {@code pom.xml} without dragging in
     * {@code spring-boot-starter-oauth2-resource-server} just for one
     * principal claim.</p>
     *
     * @param userId  authenticated user id, set by the upstream JWT filter
     * @param request coin + optional amount + correlation key
     * @return the address details the mobile renders into a QR / copy-button
     */
    @PostMapping("/deposit-address")
    public ResponseEntity<BreetAddressResponse> createDepositAddress(
            @RequestHeader(value = "X-User-Id", required = false, defaultValue = "anonymous") String userId,
            @Valid @RequestBody BreetCreateAddressRequest request
    ) {
        log.info("breet: createDepositAddress user={} coin={}", userId, request.getCoin());
        BreetAddressResponse resp = breetService.createDepositAddress(userId, request);
        return ResponseEntity.ok(resp);
    }

    /**
     * Poll the deposit status. Returns 200 with the deposit once Breet
     * has reported an inbound payment; returns 404 while the address is
     * still idle (no payment seen). The mobile polling treats the 404
     * as a "keep waiting" signal.
     */
    @GetMapping("/deposit-address/{addressId}")
    public ResponseEntity<BreetDepositResponse> getDeposit(@PathVariable String addressId) {
        return breetService
                .getDeposit(addressId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
