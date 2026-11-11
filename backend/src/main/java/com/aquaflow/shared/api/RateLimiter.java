package com.aquaflow.shared.api;

import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Bộ đếm theo cửa sổ cố định, giữ trong bộ nhớ của một tiến trình backend.
 * Đủ cho triển khai một máy chủ; chạy nhiều bản backend thì cần chuyển sang kho dùng chung.
 *
 * <p>Khóa thường gồm địa chỉ IP của khách. Sau reverse proxy, IP đúng chỉ có khi bật
 * {@code server.forward-headers-strategy}; nếu không, mọi khách sẽ dùng chung một bộ đếm.
 */
public final class RateLimiter {

    private record Window(long until, int count) {
    }

    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;
    private final long windowMillis;
    private final int maxKeys;

    public RateLimiter(Clock clock, Duration window, int maxKeys) {
        this.clock = clock;
        this.windowMillis = window.toMillis();
        this.maxKeys = maxKeys;
    }

    /**
     * Tính một lượt cho {@code key}; trả {@code false} khi đã đủ {@code limit} lượt trong cửa sổ.
     * Khi bộ nhớ đầy khóa, khóa mới bị từ chối (đóng an toàn) để không bị vượt bằng cách đổi khóa liên tục.
     */
    public synchronized boolean tryAcquire(String key, int limit) {
        Window window = current(key);
        if (window == null) {
            if (windows.size() >= maxKeys) return false;
            windows.put(key, new Window(clock.millis() + windowMillis, 1));
            return true;
        }
        if (window.count() >= limit) return false;
        windows.put(key, new Window(window.until(), window.count() + 1));
        return true;
    }

    /** Đã đủ {@code limit} lượt ghi bằng {@link #record} trong cửa sổ hiện tại chưa (không tính thêm lượt). */
    public synchronized boolean isLimited(String key, int limit) {
        Window window = current(key);
        return window != null && window.count() >= limit;
    }

    /**
     * Ghi thêm một lượt (ví dụ một lần đăng nhập sai). Khi bộ nhớ đầy khóa thì bỏ qua,
     * để lũ khóa mới không chặn được người dùng hợp lệ.
     */
    public synchronized void record(String key) {
        Window window = current(key);
        if (window == null) {
            if (windows.size() < maxKeys) windows.put(key, new Window(clock.millis() + windowMillis, 1));
            return;
        }
        windows.put(key, new Window(window.until(), window.count() + 1));
    }

    public long windowSeconds() {
        return windowMillis / 1000;
    }

    private Window current(String key) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until() <= now);
        return windows.get(key);
    }
}
