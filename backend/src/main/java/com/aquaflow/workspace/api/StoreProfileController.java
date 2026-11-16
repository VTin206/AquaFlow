package com.aquaflow.workspace.api;

import com.aquaflow.workspace.application.StoreSettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name="Public store profile")
public class StoreProfileController {
    private final StoreSettingsService service;
    public StoreProfileController(StoreSettingsService service) { this.service=service; }
    /** Hồ sơ công khai: liên hệ và tài khoản nhận chuyển khoản (để khách quét mã QR); không có mã số thuế hay cài đặt nội bộ. */
    public record Profile(String storeName,String address,String phone,String email,String openingHours,
                          String bankName,String bankAccount,String bankHolder) {}
    @GetMapping("/api/v1/store-profile")
    public Profile get() {
        var data=service.get().settings();
        return new Profile(data.storeName(),data.address(),data.phone(),data.email(),data.openingHours(),
                data.bankName(),data.bankAccount(),data.bankHolder());
    }
}
