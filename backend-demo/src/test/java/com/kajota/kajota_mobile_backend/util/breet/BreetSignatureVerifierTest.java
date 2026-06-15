package com.kajota.kajota_mobile_backend.util.breet;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pin the HMAC-SHA256 contract Breet's webhook depends on. Vectors are
 * computed off the project's own helper, but verified against the RFC
 * 4231 reference vector below to prove the implementation is correct
 * (not just self-consistent).
 */
class BreetSignatureVerifierTest {

    /**
     * RFC 4231 test case #1: key = 0x0b * 20, data = "Hi There",
     * expected HMAC-SHA256 = b0344c61d8db38535ca8afceaf0bf12b
     *                       881dc200c9833da726e9376c2e32cff7
     */
    @Test
    void computeHmacSha256_matchesRfc4231Vector1() {
        byte[] key = new byte[20];
        for (int i = 0; i < key.length; i++) {
            key[i] = 0x0b;
        }
        String secret = new String(key, StandardCharsets.ISO_8859_1);
        byte[] data = "Hi There".getBytes(StandardCharsets.UTF_8);

        String expected =
                "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";
        byte[] mac = BreetSignatureVerifier.computeHmacSha256(data, secret);
        assertEquals(expected, BreetSignatureVerifier.hexEncode(mac));
    }

    @Test
    void verify_returnsTrueForMatchingSignature() {
        byte[] body = "{\"event\":\"deposit.detected\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "shared-webhook-secret";
        byte[] mac = BreetSignatureVerifier.computeHmacSha256(body, secret);
        String hex = BreetSignatureVerifier.hexEncode(mac);

        assertTrue(BreetSignatureVerifier.verify(body, hex, secret));
    }

    @Test
    void verify_returnsFalseForMismatchedBody() {
        byte[] body = "{\"event\":\"deposit.detected\"}".getBytes(StandardCharsets.UTF_8);
        byte[] tampered = "{\"event\":\"deposit.spoofed\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "shared-webhook-secret";
        byte[] mac = BreetSignatureVerifier.computeHmacSha256(body, secret);
        String hex = BreetSignatureVerifier.hexEncode(mac);

        assertFalse(BreetSignatureVerifier.verify(tampered, hex, secret));
    }

    @Test
    void verify_returnsFalseForMismatchedSecret() {
        byte[] body = "{\"event\":\"deposit.detected\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "shared-webhook-secret";
        String wrongSecret = "leaked-old-secret";
        byte[] mac = BreetSignatureVerifier.computeHmacSha256(body, secret);
        String hex = BreetSignatureVerifier.hexEncode(mac);

        assertFalse(BreetSignatureVerifier.verify(body, hex, wrongSecret));
    }

    @Test
    void verify_returnsFalseForMalformedSignature() {
        byte[] body = "{\"event\":\"deposit.detected\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "shared-webhook-secret";

        assertFalse(BreetSignatureVerifier.verify(body, "zzznotvalidhex", secret));
        // Odd-length hex.
        assertFalse(BreetSignatureVerifier.verify(body, "abc", secret));
        assertFalse(BreetSignatureVerifier.verify(body, null, secret));
    }

    @Test
    void verify_returnsFalseForNullInputs() {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        assertFalse(BreetSignatureVerifier.verify(null, "deadbeef", "k"));
        assertFalse(BreetSignatureVerifier.verify(body, null, "k"));
        assertFalse(BreetSignatureVerifier.verify(body, "deadbeef", null));
    }

    @Test
    void hexEncode_isLowercase() {
        byte[] bytes = {(byte) 0xab, (byte) 0xcd, (byte) 0xef, 0x12, 0x34};
        assertEquals("abcdef1234", BreetSignatureVerifier.hexEncode(bytes));
    }

    @Test
    void hexDecode_roundTripsThroughHexEncode() {
        byte[] bytes = {(byte) 0xde, (byte) 0xad, (byte) 0xbe, (byte) 0xef, 0x00, 0x7f};
        String hex = BreetSignatureVerifier.hexEncode(bytes);
        assertArrayEquals(bytes, BreetSignatureVerifier.hexDecode(hex));
    }

    @Test
    void hexDecode_returnsNullForInvalid() {
        assertNull(BreetSignatureVerifier.hexDecode("xyz"));
        assertNull(BreetSignatureVerifier.hexDecode("abc"));
        assertNull(BreetSignatureVerifier.hexDecode(null));
    }
}
