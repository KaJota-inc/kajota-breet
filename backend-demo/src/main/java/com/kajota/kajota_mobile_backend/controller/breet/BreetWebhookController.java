package com.kajota.kajota_mobile_backend.controller.breet;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetWebhookPayload;
import com.kajota.kajota_mobile_backend.service.breet.BreetService;
import com.kajota.kajota_mobile_backend.util.breet.BreetSignatureVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inbound webhook receiver for Breet's deposit-detected / deposit-settled
 * events.
 *
 * <p>Auth model differs from the rest of the API: Breet doesn't send a
 * JWT — they sign the raw body with HMAC-SHA256 keyed by our shared
 * webhook secret ({@code BREET_WEBHOOK_SECRET}) and post the hex digest
 * in the {@code X-Breet-Signature} header. We verify before applying
 * any wallet credit.</p>
 *
 * <p>Spring usually deserialises the body before the controller runs,
 * which means we can't HMAC the bytes directly. We accept the body as a
 * raw {@code byte[]} and decode JSON ourselves so the bytes we sign
 * over match the bytes Breet signed.</p>
 *
 * <p>This endpoint must NOT be JWT-gated — Breet's posts originate from
 * their backend, not a user agent. Configure Spring Security to bypass
 * authentication for {@code POST /api/v1/webhooks/breet/**} or wire
 * IP-allowlist protection in addition to the HMAC.</p>
 */
@RestController
@RequestMapping("/api/v1/webhooks/breet")
@RequiredArgsConstructor
@Slf4j
public class BreetWebhookController {

    private final BreetService breetService;
    private final ObjectMapper objectMapper;

    @Value("${breet.webhook-secret:}")
    private String webhookSecret;

    /**
     * Receive a deposit-detected / deposit-settled event from Breet.
     *
     * @param signature hex-encoded HMAC-SHA256 of the raw body
     * @param rawBody   the request body bytes as Breet sent them
     */
    @PostMapping("/deposit")
    public ResponseEntity<Void> receiveDeposit(
            @RequestHeader(value = "X-Breet-Signature", required = false) String signature,
            @RequestBody byte[] rawBody
    ) {
        if (signature == null || signature.isBlank()) {
            log.warn("breet webhook: missing X-Breet-Signature header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.error("breet webhook: BREET_WEBHOOK_SECRET is not configured — rejecting");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (!BreetSignatureVerifier.verify(rawBody, signature, webhookSecret)) {
            log.warn("breet webhook: signature mismatch — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        BreetWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, BreetWebhookPayload.class);
        } catch (Exception e) {
            log.warn("breet webhook: malformed JSON body", e);
            return ResponseEntity.badRequest().build();
        }

        try {
            breetService.handleWebhook(payload);
        } catch (RuntimeException e) {
            // Don't 500 back to Breet — they'll retry, multiplying the
            // duplicate-credit risk. Log loudly + return 200 so the
            // delivery is marked complete; we replay from the DB if needed.
            log.error("breet webhook: handler threw on address={}", payload.getAddressId(), e);
        }
        return ResponseEntity.ok().build();
    }
}
