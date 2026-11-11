package com.aquaflow.shared.api;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    /** Đồng hồ chỉnh tay để kiểm tra hết cửa sổ mà không phải chờ. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-11T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MutableClock clock = new MutableClock();

    @Test
    void tryAcquireAllowsUpToLimitThenResetsAfterWindow() {
        RateLimiter limiter = new RateLimiter(clock, Duration.ofMinutes(15), 100);

        for (int i = 0; i < 3; i++) assertThat(limiter.tryAcquire("a", 3)).isTrue();
        assertThat(limiter.tryAcquire("a", 3)).isFalse();
        assertThat(limiter.tryAcquire("b", 3)).isTrue();

        clock.advance(Duration.ofMinutes(15));
        assertThat(limiter.tryAcquire("a", 3)).isTrue();
    }

    @Test
    void tryAcquireRejectsNewKeysWhenFull() {
        RateLimiter limiter = new RateLimiter(clock, Duration.ofMinutes(15), 2);
        assertThat(limiter.tryAcquire("a", 5)).isTrue();
        assertThat(limiter.tryAcquire("b", 5)).isTrue();

        assertThat(limiter.tryAcquire("c", 5)).isFalse();
        assertThat(limiter.tryAcquire("a", 5)).isTrue();
    }

    @Test
    void recordCountsOnlyRecordedEventsAndNeverBlocksWhenFull() {
        RateLimiter limiter = new RateLimiter(clock, Duration.ofMinutes(15), 1);

        assertThat(limiter.isLimited("a", 2)).isFalse();
        limiter.record("a");
        assertThat(limiter.isLimited("a", 2)).isFalse();
        limiter.record("a");
        assertThat(limiter.isLimited("a", 2)).isTrue();

        // Đầy khóa: khóa mới không bị ghi và cũng không bị chặn.
        limiter.record("b");
        limiter.record("b");
        assertThat(limiter.isLimited("b", 2)).isFalse();

        clock.advance(Duration.ofMinutes(15));
        assertThat(limiter.isLimited("a", 2)).isFalse();
        assertThat(limiter.windowSeconds()).isEqualTo(900);
    }
}
