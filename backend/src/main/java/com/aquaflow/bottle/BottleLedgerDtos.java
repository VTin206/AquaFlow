package com.aquaflow.bottle;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public class BottleLedgerDtos {
    public record Create(@NotNull UUID requestId,
            @NotNull @Pattern(regexp="GIVE|RECEIVE|LOSS|COLLECT|REFUND") String kind,
            @Positive Long bottleTypeId, @Positive Integer quantity,
            @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal amount,
            @Size(max=300) String note) {
        public Create { note = note == null || note.isBlank() ? null : note.trim(); }
    }
    public record Balance(long customerId,String name,boolean active,long bottlesHeld,
            BigDecimal depositHeld,BigDecimal requiredDeposit,BigDecimal refundable) {}
    public record TypeBalance(long bottleTypeId,String name,boolean active,long held,
            BigDecimal unitAmount,BigDecimal liability) {}
    public record Entry(String id,String kind,String bottleType,long bottles,BigDecimal deposit,
            String note,String actor,OffsetDateTime at) {}
    public record Ledger(Balance balance,List<TypeBalance> types,List<Entry> entries) {}
}
