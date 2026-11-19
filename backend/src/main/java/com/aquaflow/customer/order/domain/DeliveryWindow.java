package com.aquaflow.customer.order.domain;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Khung giờ giao khách hẹn: từ {@code at} tới {@code until}. Không có {@code until} là hẹn một mốc giờ như trước.
 * Khung phải có giờ bắt đầu, kết thúc sau bắt đầu và dài không quá 12 tiếng.
 */
public final class DeliveryWindow {

    public static final Duration MAX_LENGTH = Duration.ofHours(12);

    private DeliveryWindow() {
    }

    public static boolean isValid(OffsetDateTime at, OffsetDateTime until) {
        return until == null
                || (at != null && until.isAfter(at) && !until.isAfter(at.plus(MAX_LENGTH)));
    }

    /** Hạn giao để tính trễ: cuối khung nếu có, không thì mốc hẹn. */
    public static OffsetDateTime deadline(OffsetDateTime at, OffsetDateTime until) {
        return until != null ? until : at;
    }
}
