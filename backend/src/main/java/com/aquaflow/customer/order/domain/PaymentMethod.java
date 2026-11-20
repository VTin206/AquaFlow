package com.aquaflow.customer.order.domain;

/**
 * Cách khách chọn trả tiền khi đặt đơn web: {@code COD} trả khi nhận hàng, {@code TRANSFER} chuyển khoản trước theo
 * mã QR sau khi cửa hàng xác nhận giá. Đơn tạo tại quầy và đơn cũ không có lựa chọn này (null).
 */
public enum PaymentMethod {
    COD,
    TRANSFER
}
