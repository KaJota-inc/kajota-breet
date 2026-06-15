package com.kajota.kajota_mobile_backend.model.dto.response.breet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response from {@code POST /api/v1/breet/deposit-address}.
 *
 * <p>Wire shape mirrors {@code BreetDepositAddress} in the mobile-side
 * {@code src/services/breet/types.ts}. The {@code qrCode} payload is
 * optional; when absent the mobile renders the bare address text.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BreetAddressResponse {

    /** Backend-side id. The mobile polls {@code GET /breet/deposit-address/{id}}. */
    private String id;

    /** Coin + network, echoed from the request. */
    private String coin;

    /** The actual deposit address (paste-friendly). */
    private String address;

    /**
     * Optional QR payload — typically a {@code coin:address?amount=X} URI,
     * or a hosted PNG URL depending on the upstream Breet response shape.
     */
    private String qrCode;

    /** Epoch ms when the address stops accepting funds. Optional. */
    private Long expiresAt;

    /** What inbound crypto auto-converts to: NGN / USDC / USDT / GHS. */
    private String settlementCurrency;
}
