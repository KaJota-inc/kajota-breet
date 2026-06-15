package com.kajota.kajota_mobile_backend.util.breet;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * HMAC-SHA256 verifier for Breet's webhook signatures.
 *
 * <p>Breet attaches an {@code X-Breet-Signature} header to every outbound
 * webhook, formatted as a hex-encoded HMAC-SHA256 of the raw request body
 * keyed by the shared secret (env: {@code BREET_WEBHOOK_SECRET}).</p>
 *
 * <p>We compute the same MAC on our side and compare in constant time —
 * a string {@code equals} would leak timing info that an attacker could
 * use to forge signatures byte by byte.</p>
 *
 * <p>This class is stateless and side-effect-free; tests can exercise it
 * with known vectors without spinning up Spring.</p>
 */
public final class BreetSignatureVerifier {

    private static final String HMAC_SHA_256 = "HmacSHA256";

    private BreetSignatureVerifier() {
        // utility class — no instances
    }

    /**
     * Verify that {@code providedSignatureHex} matches the HMAC-SHA256 of
     * {@code rawBody} keyed by {@code secret}.
     *
     * <p>All comparisons are constant-time. Whitespace and case are NOT
     * normalised — the caller is expected to forward the header value
     * verbatim.</p>
     *
     * @param rawBody              the exact bytes of the request body as
     *                             received over the wire (not the parsed
     *                             JSON — order + whitespace matter)
     * @param providedSignatureHex the signature header from Breet, hex
     *                             encoded (no {@code sha256=} prefix)
     * @param secret               the shared webhook secret
     * @return {@code true} if the signature is valid
     */
    public static boolean verify(byte[] rawBody, String providedSignatureHex, String secret) {
        if (rawBody == null || providedSignatureHex == null || secret == null) {
            return false;
        }
        byte[] expected = computeHmacSha256(rawBody, secret);
        byte[] provided = hexDecode(providedSignatureHex);
        if (provided == null) {
            return false;
        }
        return MessageDigest.isEqual(expected, provided);
    }

    /**
     * Compute the HMAC-SHA256 of {@code body} keyed by {@code secret}.
     * Exposed so callers can log expected vs. provided when debugging
     * a signature mismatch in a non-prod env. Don't log raw expected
     * signatures in production.
     */
    public static byte[] computeHmacSha256(byte[] body, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA_256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA_256));
            return mac.doFinal(body);
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 not available", e);
        }
    }

    /** Convert a hex string to bytes. Returns null on any malformed input. */
    static byte[] hexDecode(String hex) {
        if (hex == null) {
            return null;
        }
        int len = hex.length();
        if ((len & 1) != 0) {
            return null;
        }
        byte[] out = new byte[len / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(hex.charAt(i * 2), 16);
            int lo = Character.digit(hex.charAt(i * 2 + 1), 16);
            if (hi < 0 || lo < 0) {
                return null;
            }
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    /** Convert bytes to lowercase hex. Useful for log + test vectors. */
    public static String hexEncode(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xf, 16));
            sb.append(Character.forDigit(b & 0xf, 16));
        }
        return sb.toString();
    }
}
