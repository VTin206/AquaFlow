package com.aquaflow.shared.address;

import com.aquaflow.customer.api.dto.MyAddressRequest;
import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.text.Normalizer;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryWardTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void listCoversOnlyOldHoChiMinhCity() {
        assertThat(DeliveryWards.ALL).hasSize(102);
        assertThat(DeliveryWards.ALL.stream().filter(ward -> ward.startsWith("Phường "))).hasSize(78);
        assertThat(DeliveryWards.ALL.stream().filter(ward -> ward.startsWith("Xã "))).hasSize(24);
        assertThat(DeliveryWards.ALL).contains("Phường Bến Thành", "Xã Thạnh An", "Xã Cần Giờ")
                .doesNotContain("Phường Thủ Dầu Một", "Phường Dĩ An", "Phường Vũng Tàu", "Xã Thanh An", "Đặc khu Côn Đảo");
    }

    @Test
    void acceptsTrimmedAndDecomposedNames() {
        assertThat(DeliveryWards.contains(" Phường Tân Định ")).isTrue();
        assertThat(DeliveryWards.contains(Normalizer.normalize("Phường Tân Định", Normalizer.Form.NFD))).isTrue();
        assertThat(DeliveryWards.contains("Gò Vấp")).isFalse();
        assertThat(DeliveryWards.contains(null)).isFalse();
    }

    @Test
    void addressOutsideDeliveryAreaIsRejected() {
        assertThat(validator.validate(new MyAddressRequest("An", "0901234567", "12 Lê Lợi", "Phường Bến Thành", true))).isEmpty();
        assertThat(validator.validate(new MyAddressRequest("An", "0901234567", "8 Đại lộ Bình Dương", "Phường Thủ Dầu Một", true)))
                .anySatisfy(violation -> assertThat(violation.getPropertyPath().toString()).isEqualTo("area"));
    }

    @Test
    void guestOrderAreaIsOptionalButMustBeInDeliveryArea() {
        List<OrderItemRequest> items = List.of(new OrderItemRequest(101L, 2));
        assertThat(validator.validate(new GuestOrderCreateRequest("An", "0901234567", "12 Lê Lợi", null, null, items, null))).isEmpty();
        assertThat(validator.validate(new GuestOrderCreateRequest("An", "0901234567", "12 Lê Lợi", "Phường Vũng Tàu", null, items, null)))
                .anySatisfy(violation -> assertThat(violation.getPropertyPath().toString()).isEqualTo("deliveryArea"));
    }
}
