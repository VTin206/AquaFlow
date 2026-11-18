package com.aquaflow.workspace.api;

import jakarta.validation.constraints.*;

public record StoreSettingsData(
        @NotBlank @Size(max = 120) String storeName,
        @NotBlank @Size(max = 255) String address,
        @NotBlank @Pattern(regexp = "(?:0[0-9]{9,10}|\\+?84[0-9]{9,10})") String phone,
        @Email @Size(max = 254) String email,
        @Size(max = 100) String openingHours,
        @Pattern(regexp = "[0-9]{10}(-[0-9]{3})?") String taxCode,
        @Size(max = 150) String bankName,
        @Pattern(regexp = "[0-9]{6,20}") String bankAccount,
        @Size(max = 150) String bankHolder,
        @Size(max = 200) String invoiceNote,
        @NotNull @Min(1) @Max(730) Integer expiryWarningDays,
        @NotNull @Min(0) @Max(1000000) Integer defaultLowStock,
        /** Thiếu (dữ liệu lưu trước khi có mục này, client cũ): dùng mức đang áp dụng hoặc giữ nguyên khi lưu. */
        @jakarta.validation.Valid DeliveryFees deliveryFees) {
    public StoreSettingsData(String storeName, String address, String phone, String email, String openingHours, String taxCode,
                             String bankName, String bankAccount, String bankHolder, String invoiceNote,
                             Integer expiryWarningDays, Integer defaultLowStock) {
        this(storeName, address, phone, email, openingHours, taxCode, bankName, bankAccount, bankHolder, invoiceNote,
                expiryWarningDays, defaultLowStock, null);
    }

    /** Cùng cài đặt, thay phí giao. */
    public StoreSettingsData withDeliveryFees(DeliveryFees fees) {
        return new StoreSettingsData(storeName, address, phone, email, openingHours, taxCode, bankName, bankAccount, bankHolder,
                invoiceNote, expiryWarningDays, defaultLowStock, fees);
    }

    public StoreSettingsData {
        storeName=trim(storeName); address=trim(address);
        phone=phone==null?null:phone.trim().replaceAll("[\\s().-]", "");
        email=optional(email); openingHours=optional(openingHours); taxCode=optional(taxCode);
        bankName=optional(bankName); bankAccount=optional(bankAccount); bankHolder=optional(bankHolder);
        if(bankHolder!=null) bankHolder=bankHolder.toUpperCase(java.util.Locale.ROOT);
        invoiceNote=optional(invoiceNote);
    }
    @com.fasterxml.jackson.annotation.JsonIgnore
    @AssertTrue(message="Nhập đủ ngân hàng, số tài khoản và chủ tài khoản, hoặc để trống cả ba")
    public boolean isBankDetailsComplete() {
        return (bankName==null && bankAccount==null && bankHolder==null)
            || (bankName!=null && bankAccount!=null && bankHolder!=null);
    }
    private static String trim(String value) { return value==null?null:value.trim(); }
    private static String optional(String value) { return value==null || value.isBlank()?null:value.trim(); }
}
