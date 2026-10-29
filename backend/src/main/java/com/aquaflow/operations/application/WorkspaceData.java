package com.aquaflow.operations.application;

import com.aquaflow.shared.api.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Shared DTO conversion and validation for the administration API. */
final class WorkspaceData {
    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private WorkspaceData() {}
    static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i=0;i<pairs.length;i+=2) result.put((String)pairs[i], pairs[i+1]);
        return result;
    }
    static String str(Object o) { return o == null ? "" : o.toString(); }
    static long number(Object o) { return o == null ? 0 : ((Number)o).longValue(); }
    static BigDecimal amount(Object o) { return o == null ? BigDecimal.ZERO : new BigDecimal(o.toString()); }
    static String iso(Object o) {
        if(o == null) return null;
        if(o instanceof Timestamp t) return t.toInstant().toString();
        if(o instanceof OffsetDateTime t) return t.toInstant().toString();
        return o.toString();
    }
    static Object json(Object o) {
        if(o == null) return null;
        try { return JSON.readValue(o.toString(), Object.class); }
        catch(Exception e) { throw new IllegalStateException("Invalid stored JSON", e); }
    }
    static String encode(Object o) {
        try { return JSON.writeValueAsString(o); }
        catch(Exception e) { throw new IllegalArgumentException("Invalid JSON", e); }
    }
    static String text(JsonNode n, String key, int max, boolean required) {
        JsonNode v=n.path(key);
        if(!v.isMissingNode() && !v.isNull() && !v.isTextual()) throw new BadRequestException(key+" phải là chuỗi.");
        String s=v.isNull()?"":v.asText("").trim();
        if((required && s.isEmpty()) || s.length()>max) throw new BadRequestException("Kiểm tra trường "+key+" (tối đa "+max+" ký tự).");
        return s;
    }
    static int integer(JsonNode n,String key,int min,int max) {
        JsonNode v=n.path(key);
        if(!v.isIntegralNumber() || !v.canConvertToInt() || v.intValue()<min || v.intValue()>max) throw new BadRequestException(key+" phải là số nguyên từ "+min+" đến "+max+".");
        return v.intValue();
    }
    static BigDecimal money(JsonNode n,String key,boolean positive) {
        JsonNode v=n.path(key);
        if(!v.isNumber()) throw new BadRequestException("Nhập số tiền "+key+".");
        BigDecimal value=v.decimalValue();
        if(value.signum()<(positive?1:0) || value.scale()>2 || value.compareTo(new BigDecimal("999999999999"))>0) throw new BadRequestException("Số tiền không hợp lệ: "+key);
        return value;
    }
    static long id(JsonNode n) {
        try { long id=Long.parseLong(n.asText()); if(id>0) return id; }
        catch(NumberFormatException ignored) {}
        throw new BadRequestException("Mã bản ghi không hợp lệ.");
    }
    static String phone(String s) {
        String p=s.replaceAll("[\\s().-]", "");
        if(p.startsWith("+84")) p="0"+p.substring(3);
        if(p.startsWith("84")) p="0"+p.substring(2);
        if(!p.matches("0[0-9]{9,10}")) throw new BadRequestException("Số điện thoại không hợp lệ.");
        return p;
    }
    static LocalDate date(String s) {
        try { return LocalDate.parse(s); }
        catch(Exception e) { throw new BadRequestException("Ngày không hợp lệ."); }
    }
}
