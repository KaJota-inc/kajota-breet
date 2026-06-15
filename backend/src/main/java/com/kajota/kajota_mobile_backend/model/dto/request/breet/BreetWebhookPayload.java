package com.kajota.kajota_mobile_backend.model.dto.request.breet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload Breet posts to {@code POST /api/v1/webhooks/breet/deposit} when an
 * inbound crypto payment is detected against one of our generated addresses.
 *
 * <p>Validated via HMAC-SHA256 against the secret stored in
 * {@code BREET_WEBHOOK_SECRET} before any wallet credit is applied —
 * see {@link com.kajota.kajota_mobile_backend.util.breet.BreetSignatureVerifier}.</p>
 *
 * <p>The exact field names match Breet's outbound webhook contract; align
 * with their developer docs when their schema rev moves.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BreetWebhookPayload {

    /** Event type, e.g. {@code deposit.detected}, {@code deposit.settled}. */
    private String event;

    /** Breet's id for the address. Maps to our local {@code addressId}. */
    private String addressId;

    /** Coin + network. */
    private String coin;

    /** Crypto amount received (decimal string). */
    private String amountCrypto;

    /** Settled amount in our configured settlement currency. */
    private String amountSettled;

    /** Settlement currency: NGN / USDC / USDT / GHS. */
    private String settlementCurrency;

    /** Network tx hash. */
    private String txHash;

    /** Echo of the {@code reference} from the original create-address call. */
    private String reference;

    /** Epoch ms the inbound payment was detected. */
    private Long detectedAt;
}
