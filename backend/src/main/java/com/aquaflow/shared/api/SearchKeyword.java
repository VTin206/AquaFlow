package com.aquaflow.shared.api;

import java.util.regex.Pattern;

/**
 * Từ khóa tìm kiếm cho câu SQL dùng {@code af_search_text} / {@code af_phone_digits} (migration V26),
 * cùng quy tắc với {@code matchesSearch} ở frontend.
 *
 * @param text  từ khóa đã escape ký tự đại diện của LIKE; SQL tự bỏ dấu và chữ hoa bằng {@code af_search_text(?)}
 * @param phone chữ số của từ khóa khi từ khóa trông như số điện thoại, ngược lại {@code null}
 */
public record SearchKeyword(String text, String phone) {

    private static final Pattern PHONE_LIKE = Pattern.compile("^[+\\d\\s().-]+$");

    /** {@code null} khi không có từ khóa, để câu SQL bỏ qua điều kiện tìm kiếm. */
    public static SearchKeyword of(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String trimmed = raw.trim();
        String phone = null;
        if (PHONE_LIKE.matcher(trimmed).matches() && trimmed.chars().anyMatch(Character::isDigit)) {
            phone = trimmed.replaceAll("\\D", "").replaceFirst("^84(?=\\d{9,10}$)", "0");
        }
        return new SearchKeyword(escapeLike(trimmed), phone);
    }

    /**
     * Điều kiện SQL cho câu dùng tham số có tên: {@code textExpr} (bỏ dấu, chữ thường) chứa từ khóa, hoặc
     * chữ số của {@code phoneExpr} chứa số điện thoại trong từ khóa. Thêm tham số {@code keyword}, {@code phone}.
     */
    public String condition(String textExpr, String phoneExpr,
                            org.springframework.jdbc.core.namedparam.MapSqlParameterSource params) {
        params.addValue("keyword", text);
        String sql = "af_search_text(" + textExpr + ") LIKE '%' || af_search_text(:keyword) || '%'";
        if (phone != null && !phone.isEmpty() && phoneExpr != null) {
            params.addValue("phone", phone);
            sql += " OR af_phone_digits(" + phoneExpr + ") LIKE '%' || :phone || '%'";
        }
        return "(" + sql + ")";
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
