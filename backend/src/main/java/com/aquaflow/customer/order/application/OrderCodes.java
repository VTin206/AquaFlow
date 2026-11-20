package com.aquaflow.customer.order.application;

import java.security.SecureRandom;

/**
 * Sinh mã đơn khách dùng để tra cứu (kèm số điện thoại): ngẫu nhiên, không tăng dần nên không đoán được mã đơn khác
 * và không lộ số lượng đơn của cửa hàng. Bỏ các ký tự dễ nhầm khi đọc qua điện thoại (0/O, 1/I/L).
 */
public final class OrderCodes {

    static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    static final int LENGTH = 6;
    public static final String PATTERN = "AF-[" + ALPHABET + "]{" + LENGTH + "}";

    private static final SecureRandom RANDOM = new SecureRandom();

    private OrderCodes() {
    }

    public static String generate() {
        StringBuilder code = new StringBuilder("AF-");
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
