package com.aquaflow.inventory.brand;

import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Array;
import java.util.*;

/**
 * Thương hiệu sản phẩm. Sản phẩm vẫn lưu chữ thương hiệu gõ tay ({@code products.brand}); {@code products.brand_id}
 * được nối tự động khi chữ đó trùng tên hoặc một tên gọi khác của thương hiệu (không phân biệt hoa thường).
 */
@Service
@Transactional(readOnly = true)
public class BrandService {
    public record Brand(long id, String name, List<String> aliases, String logo, long productCount) {}
    public record BrandRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 30) List<@NotBlank @Size(max = 150) String> aliases,
            @Size(max = 500) @Pattern(regexp = "^(/|https?://).*", message = "Logo là đường dẫn bắt đầu bằng / hoặc http(s)://") String logo) {}

    private final JdbcTemplate jdbc;
    public BrandService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT = """
            SELECT b.id,b.name,b.aliases,b.logo,(SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id) AS products
            FROM brands b
            """;

    private Brand map(java.sql.ResultSet rs) throws java.sql.SQLException {
        Array aliases = rs.getArray("aliases");
        return new Brand(rs.getLong("id"), rs.getString("name"),
                aliases == null ? List.of() : List.of((String[]) aliases.getArray()), rs.getString("logo"), rs.getLong("products"));
    }

    public List<Brand> list() {
        return jdbc.query(SELECT + " ORDER BY lower(b.name)", (rs, n) -> map(rs));
    }

    public Brand get(long id) {
        return jdbc.query(SELECT + " WHERE b.id=?", (rs, n) -> map(rs), id).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thương hiệu"));
    }

    @Transactional
    public Brand create(BrandRequest request) {
        String name = request.name().trim();
        var aliases = aliases(name, request.aliases(), List.of());
        ensureFree(null, name, aliases);
        long id = jdbc.queryForObject("INSERT INTO brands(name,aliases,logo) VALUES (?,?,?) RETURNING id", Long.class,
                name, array(aliases), blank(request.logo()));
        link(id);
        return get(id);
    }

    /** Đổi tên thì giữ tên cũ làm tên gọi khác, để sản phẩm đang ghi tên cũ vẫn thuộc thương hiệu này. */
    @Transactional
    public Brand update(long id, BrandRequest request) {
        var current = lock(id);
        String name = request.name().trim();
        var keep = current.name().equalsIgnoreCase(name) ? List.<String>of() : List.of(current.name());
        var aliases = aliases(name, request.aliases(), keep);
        ensureFree(id, name, aliases);
        jdbc.update("UPDATE brands SET name=?,aliases=?,logo=?,updated_at=NOW() WHERE id=?", name, array(aliases), blank(request.logo()), id);
        // Tên gọi khác bị bỏ thì sản phẩm ghi tên đó không còn thuộc thương hiệu này nữa.
        jdbc.update("""
                UPDATE products SET brand_id=NULL WHERE brand_id=?
                  AND NOT (lower(btrim(brand))=lower(?) OR lower(btrim(brand))=ANY(?))
                """, id, name, array(aliases));
        link(id);
        return get(id);
    }

    @Transactional
    public void delete(long id) {
        var brand = lock(id);
        if (brand.productCount() > 0)
            throw new ConflictException("Thương hiệu đang có " + brand.productCount() + " sản phẩm; đổi thương hiệu của các sản phẩm đó trước khi xóa");
        jdbc.update("DELETE FROM brands WHERE id=?", id);
    }

    /** Gọi sau khi tạo/sửa sản phẩm: nối brand_id theo chữ thương hiệu đang ghi trên sản phẩm. */
    @Transactional
    public void linkProduct(Long productId) {
        if (productId == null) return;
        jdbc.update("""
                UPDATE products p SET brand_id=(
                  SELECT b.id FROM brands b
                  WHERE p.brand IS NOT NULL AND (lower(b.name)=lower(btrim(p.brand)) OR lower(btrim(p.brand))=ANY(b.aliases))
                  ORDER BY b.id LIMIT 1)
                WHERE p.id=?
                """, productId);
    }

    private void link(long id) {
        jdbc.update("""
                UPDATE products p SET brand_id=b.id FROM brands b
                WHERE b.id=? AND p.brand_id IS NULL AND p.brand IS NOT NULL
                  AND (lower(b.name)=lower(btrim(p.brand)) OR lower(btrim(p.brand))=ANY(b.aliases))
                """, id);
    }

    private Brand lock(long id) {
        if (jdbc.queryForList("SELECT id FROM brands WHERE id=? FOR UPDATE", Long.class, id).isEmpty())
            throw new NotFoundException("Không tìm thấy thương hiệu");
        return get(id);
    }

    /** Tên gọi khác: chữ thường, bỏ khoảng trắng thừa, không trùng nhau, luôn gồm chính tên chuẩn. */
    private static List<String> aliases(String name, List<String> input, List<String> keep) {
        var out = new LinkedHashSet<String>();
        out.add(name.toLowerCase(Locale.ROOT));
        for (var list : List.of(input == null ? List.<String>of() : input, keep))
            for (String alias : list) if (alias != null && !alias.isBlank()) out.add(alias.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT));
        return List.copyOf(out);
    }

    private void ensureFree(Long id, String name, List<String> aliases) {
        var taken = jdbc.queryForList("""
                SELECT b.name FROM brands b WHERE b.id<>COALESCE(CAST(? AS bigint),-1)
                  AND (lower(b.name)=ANY(?) OR b.aliases && CAST(? AS text[]))
                LIMIT 1
                """, String.class, id, array(aliases), array(aliases));
        if (!taken.isEmpty()) throw new ConflictException("Tên hoặc tên gọi khác đã thuộc thương hiệu " + taken.getFirst());
    }

    private Object array(List<String> values) {
        return jdbc.execute((java.sql.Connection c) -> c.createArrayOf("text", values.toArray()));
    }

    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
