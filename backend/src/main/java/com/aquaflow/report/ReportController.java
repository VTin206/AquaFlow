package com.aquaflow.report;

import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.shared.api.BadRequestException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/reports")
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
@io.swagger.v3.oas.annotations.tags.Tag(name="Reports")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name="bearerAuth")
public class ReportController {
    private final ReportRepository repository;
    private final Clock clock;
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    public ReportController(ReportRepository repository,Clock clock) { this.repository=repository; this.clock=clock; }
    public record Summary(LocalDate from,LocalDate to,String timezone,Instant generatedAt,
        Map<String,Object> sales,List<Map<String,Object>> days,List<Map<String,Object>> channels,
        Map<String,Object> deposits,Map<String,Object> receipts) {}

    @GetMapping("/summary")
    public Summary summary(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) OrderChannel channel,@RequestParam(required=false) FulfillmentType method) {
        var p=params(from,to,channel,method,0,20);
        return new Summary(from,to,ZONE.getId(),clock.instant(),repository.summary(p),repository.daily(p),repository.channels(p),repository.deposits(p),repository.receipts(p));
    }
    @GetMapping({"/products","/inventory","/delivery","/customers"})
    public ReportRepository.Page section(jakarta.servlet.http.HttpServletRequest request,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) OrderChannel channel,@RequestParam(required=false) FulfillmentType method,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        var p=params(from,to,channel,method,page,size);
        String path=request.getRequestURI();
        if(path.endsWith("/products")) return repository.products(p,page,size);
        if(path.endsWith("/inventory")) return repository.inventory(p,page,size);
        if(path.endsWith("/delivery")) return repository.delivery(p,page,size);
        return repository.customers(p,page,size);
    }
    private MapSqlParameterSource params(LocalDate from,LocalDate to,OrderChannel channel,FulfillmentType method,int page,int size) {
        if(from.isAfter(to) || ChronoUnit.DAYS.between(from,to)>365 || to.isAfter(LocalDate.now(clock.withZone(ZONE)))
            || page<0 || page>100000 || size<1 || size>100)
            throw new BadRequestException("Chọn tối đa 366 ngày, không quá hôm nay; phân trang phải hợp lệ");
        return new MapSqlParameterSource("start",Timestamp.from(from.atStartOfDay(ZONE).toInstant()))
            .addValue("end",Timestamp.from(to.plusDays(1).atStartOfDay(ZONE).toInstant()))
            .addValue("fromDate",from.toString()).addValue("toDate",to.toString())
            .addValue("channel",channel==null?null:channel.name(),Types.VARCHAR)
            .addValue("method",method==null?null:method.name(),Types.VARCHAR);
    }
}
