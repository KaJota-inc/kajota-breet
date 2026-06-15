package com.kajota.kajota_mobile_backend.model.dto.request.breet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;

/**
 * Mobile -> backend payload for {@code POST /api/v1/breet/deposit-address}.
 *
 * <p>Wire shape mirrors {@code CreateAddressInput} in the mobile-side
 * {@code src/services/breet/types.ts} — keep both files in sync when the
 * Breet API surface changes.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BreetCreateAddressRequest {

    /**
     * Coin + network identifier (e.g. {@code USDT-TRC20}, {@code USDC-ERC20},
     * {@code BTC}). Validated against Breet's supported list at the
     * service layer rather than baked into a Java enum so adding a new
     * coin doesn't require a backend rebuild.
     */
    @NotBlank
    private String coin;

    /**
     * Optional expected amount in the coin's standard decimal form
     * (e.g. {@code "10.5"} for 10.5 USDT). Used by the order-payment
     * flow where the address is single-use for a known total; ignored
     * for free wallet deposits.
     */
    private String amountExpected;

    /**
     * Optional correlation key (e.g. order id) — surfaces back in the
     * webhook payload so the credit handler can route to the right
     * downstream record.
     */
    private String reference;
}
