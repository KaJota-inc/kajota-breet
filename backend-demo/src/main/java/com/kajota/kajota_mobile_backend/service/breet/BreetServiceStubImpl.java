package com.kajota.kajota_mobile_backend.service.breet;

import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetCreateAddressRequest;
import com.kajota.kajota_mobile_backend.model.dto.request.breet.BreetWebhookPayload;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetAddressResponse;
import com.kajota.kajota_mobile_backend.model.dto.response.breet.BreetDepositResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory stub of {@link BreetService} for local dev + tests.
 *
 * <p>Does NOT call the real Breet API. Generates a fake address on
 * {@link #createDepositAddress(String, BreetCreateAddressRequest)} and
 * a fake settled deposit when a webhook lands. Useful for end-to-end
 * UI testing in the simulator without burning real Breet API quota or
 * staging a real test deposit on testnet.</p>
 *
 * <p>This {@code backend-demo} module strips the {@code @Profile("!prod")}
 * gate from the original — the demo app has no notion of profiles, the
 * stub is always active. The production backend mirror keeps the profile
 * gate so prod wires a real {@code HttpBreetServiceImpl}.</p>
 */
@Slf4j
@Service
public class BreetServiceStubImpl implements BreetService {

    private final ConcurrentHashMap<String, BreetAddressResponse> addresses = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, BreetDepositResponse> deposits = new ConcurrentHashMap<>();

    @Override
    public BreetAddressResponse createDepositAddress(String userId, BreetCreateAddressRequest request) {
        String id = UUID.randomUUID().toString();
        BreetAddressResponse resp = BreetAddressResponse.builder()
                .id(id)
                .coin(request.getCoin())
                .address("STUB" + id.replace("-", "").substring(0, 24))
                .qrCode(request.getCoin().toLowerCase() + ":STUB" + id.substring(0, 8))
                .settlementCurrency("NGN")
                .build();
        addresses.put(id, resp);
        log.info("breet stub: created address id={} coin={} user={}", id, request.getCoin(), userId);
        return resp;
    }

    @Override
    public Optional<BreetDepositResponse> getDeposit(String addressId) {
        return Optional.ofNullable(deposits.get(addressId));
    }

    @Override
    public void handleWebhook(BreetWebhookPayload payload) {
        BreetDepositResponse deposit = BreetDepositResponse.builder()
                .id(UUID.randomUUID().toString())
                .addressId(payload.getAddressId())
                .status("settled")
                .coin(payload.getCoin())
                .amountCrypto(payload.getAmountCrypto())
                .amountSettled(payload.getAmountSettled())
                .settlementCurrency(payload.getSettlementCurrency())
                .txHash(payload.getTxHash())
                .createdAt(payload.getDetectedAt())
                .updatedAt(payload.getDetectedAt())
                .build();
        deposits.put(payload.getAddressId(), deposit);
        log.info(
                "breet stub: webhook recorded settled deposit address={} amount={} {}",
                payload.getAddressId(),
                payload.getAmountSettled(),
                payload.getSettlementCurrency()
        );
    }
}
