package com.aquaflow.customer.application;

import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.api.dto.*;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.shared.api.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class CustomerAccountService {
    public record Profile(String fullName, String email, String phone) {}
    /** Một loại vỏ khách đang giữ và mức cọc/vỏ hiện hành. */
    public record BottleHolding(long bottleTypeId, String name, long holding, java.math.BigDecimal unitDeposit) {}
    /** Cọc tính theo khách (không theo loại vỏ): đã nộp, nghĩa vụ cọc cho số vỏ đang giữ, phần còn được hoàn. */
    public record Bottles(List<BottleHolding> bottles, java.math.BigDecimal depositPaid,
                          java.math.BigDecimal depositRequired, java.math.BigDecimal refundable) {}
    private final CustomerRepository customers;
    private final UserRepository users;
    private final CustomerAddressService addresses;
    private final org.springframework.security.crypto.password.PasswordEncoder passwords;
    private final com.aquaflow.bottle.BottleLedgerRepository bottleLedger;

    public CustomerAccountService(CustomerRepository customers, UserRepository users, CustomerAddressService addresses,
                                  org.springframework.security.crypto.password.PasswordEncoder passwords,
                                  com.aquaflow.bottle.BottleLedgerRepository bottleLedger) {
        this.customers = customers; this.users = users; this.addresses = addresses;
        this.passwords = passwords; this.bottleLedger = bottleLedger;
    }
    public Bottles bottles(Long userId) {
        long id = own(userId).getId();
        var balance = bottleLedger.balance(id);
        var held = bottleLedger.types(id).stream().filter(t -> t.held() > 0)
                .map(t -> new BottleHolding(t.bottleTypeId(), t.name(), t.held(), t.unitAmount())).toList();
        return new Bottles(held, balance.depositHeld(), balance.requiredDeposit(), balance.refundable());
    }
    /**
     * Đổi mật khẩu sau khi kiểm tra mật khẩu hiện tại. Tăng credentialsVersion nên mọi phiên (kể cả phiên đang dùng)
     * hết hiệu lực; khách đăng nhập lại bằng mật khẩu mới, giống luồng quên mật khẩu.
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        own(userId);
        if (request.newPassword().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new BadRequestException("Mật khẩu không được vượt quá 72 byte UTF-8.");
        var user = users.findById(userId).orElseThrow(() -> new NotFoundException("Không tìm thấy tài khoản"));
        if (!passwords.matches(request.currentPassword(), user.getPasswordHash()))
            throw new BadRequestException("Mật khẩu hiện tại không đúng.");
        if (passwords.matches(request.newPassword(), user.getPasswordHash()))
            throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        user.changePassword(passwords.encode(request.newPassword()));
    }
    private Customer own(Long userId) {
        return customers.findByUserIdAndActiveTrue(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ khách hàng đang hoạt động"));
    }
    private Customer lockOwn(Long userId) {
        return customers.lockActiveById(own(userId).getId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy khách hàng"));
    }
    public Profile profile(Long userId) {
        var customer = own(userId);
        var user = users.findById(userId).orElseThrow(() -> new NotFoundException("Không tìm thấy tài khoản"));
        return new Profile(customer.getFullName(), user.getEmail(), customer.getPhone());
    }
    @Transactional
    public Profile updateProfile(Long userId, MyProfileRequest request) {
        var customer = own(userId);
        customer = customers.lockActiveById(customer.getId()).orElseThrow(() -> new NotFoundException("Không tìm thấy khách hàng"));
        String phone = request.phone().replaceFirst("^\\+84", "0");
        for (String variant : List.of(phone, "+84" + phone.substring(1), "84" + phone.substring(1))) {
            if (customers.existsByPhoneAndActiveTrueAndIdNot(variant, customer.getId()))
                throw new ConflictException("Số điện thoại đã thuộc khách hàng khác. Vui lòng liên hệ cửa hàng.");
        }
        var user = users.findById(userId).orElseThrow(() -> new NotFoundException("Không tìm thấy tài khoản"));
        customer.updateDetails(request.fullName(), phone);
        user.updateCustomerProfile(request.fullName(), phone);
        return new Profile(customer.getFullName(), user.getEmail(), phone);
    }
    public List<CustomerAddressResponse> addresses(Long userId) {
        return addresses.findAllByCustomerId(own(userId).getId()).orElseThrow();
    }
    public CustomerAddressResponse address(Long userId, Long id) {
        return addresses.findById(own(userId).getId(), id).orElseThrow(() -> new NotFoundException("Không tìm thấy địa chỉ"));
    }
    @Transactional
    public CustomerAddressResponse createAddress(Long userId, MyAddressRequest request) {
        return addresses.create(lockOwn(userId).getId(), request.asAddressRequest()).orElseThrow(() -> new NotFoundException("Không tìm thấy khách hàng"));
    }
    @Transactional
    public CustomerAddressResponse updateAddress(Long userId, Long id, MyAddressRequest request) {
        return addresses.update(lockOwn(userId).getId(), id, request.asAddressRequest()).orElseThrow(() -> new NotFoundException("Không tìm thấy địa chỉ"));
    }
    @Transactional
    public void deleteAddress(Long userId, Long id) {
        if (!addresses.delete(lockOwn(userId).getId(), id)) throw new NotFoundException("Không tìm thấy địa chỉ");
    }
}
