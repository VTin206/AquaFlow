package com.aquaflow.customer.order.application;

import java.security.SecureRandom;
import java.util.Base64;

/** Sinh khóa cho liên kết tra cứu đơn: 256 bit ngẫu nhiên, base64url (43 ký tự), không đoán được. */
public final class TrackingTokens {

    private static final SecureRandom RANDOM = new SecureRandom();

    private TrackingTokens() {
    }

    public static String generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
