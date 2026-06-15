package com.kajota.kajota_mobile_backend.model.dto.response.breet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response from {@code GET /api/v1/breet/deposit-address/{id}}.
 *
 * <p>Returned when at least one deposit has been observed against the
 * address. While the address is idle (no inbound payment seen), the
 * controller returns HTTP 404 so the mobile-side polling can treat
 * "nothing yet" as a distinct kind of response.</p>
 *
 * <p>Wire shape mirrors {@code BreetDeposit} in the mobile-side
 * {@code src/services/breet/types.ts}.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BreetDepositResponse {

    /** Backend-side id for the deposit. */
    private String id;

    /** Address this deposit landed on (foreign key to BreetAddressResponse.id). */
    private String addressId;

    /** Lifecycle: {@code pending} → {@code detected} → {@code settled} / {@code expired}. */
    private String status;

    /** Coin + network. */
    private String coin;

    /**
     * Crypto amount the user sent. String for precision — the coin's
     * smallest-unit value (sats for BTC, base units for USDT, etc.)
     * with the decimal point already applied.
     */
    private String amountCrypto;

    /** Settled amount in the configured settlement currency. */
    private String amountSettled;

    /** Settlement currency: NGN / USDC / USDT / GHS. */
    private String settlementCurrency;

    /** Network tx hash once Breet confirms the inbound payment. */
    private String txHash;

    /** Epoch ms timestamps. */
    private Long createdAt;
    private Long updatedAt;
}
