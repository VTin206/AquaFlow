package com.aquaflow.inventory.brand;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class BrandPostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    /** Người dùng thật trong DB: thao tác sản phẩm ghi audit_logs có khóa ngoại tới users. */
    private RequestPostProcessor as(String role) {
        long id = jdbc.queryForObject("""
                INSERT INTO users(role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = ?), 'Brand test', ?, 'unused') RETURNING id
                """, Long.class, role, UUID.randomUUID() + "@brand.test");
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        return authentication(new UsernamePasswordAuthenticationToken(new AuthUserDetails(user), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
    private long product(String brand) {
        return jdbc.queryForObject("INSERT INTO products(sku,name,brand,unit,sale_price) VALUES (?,'Brand water',?,'Bình',50000) RETURNING id",
                Long.class, "BR-" + UUID.randomUUID(), brand);
    }
    private Long brandOf(long product) {
        return jdbc.queryForObject("SELECT brand_id FROM products WHERE id=?", Long.class, product);
    }

    @Test void ownerManagesBrandsAndProductsLinkByNameOrAlias() throws Exception {
        String name = "Nước Thử " + UUID.randomUUID().toString().substring(0, 8);
        long byAlias = product("  NT-ALIAS-" + name.substring(9) + " ");
        var created = mvc.perform(post("/api/v1/brands").with(as("ADMIN")).contentType("application/json")
                        .content(json.writeValueAsString(java.util.Map.of("name", " " + name + " ",
                                "aliases", List.of("NT-alias-" + name.substring(9)), "logo", "/images/brands/test.png"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value(name))
                .andExpect(jsonPath("$.productCount").value(1)).andReturn();
        long id = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        assertThat(brandOf(byAlias)).isEqualTo(id);

        // Sản phẩm mới ghi đúng tên (khác hoa thường) được nối khi lưu qua API sản phẩm.
        var saved = mvc.perform(post("/api/v1/products").with(as("ADMIN")).contentType("application/json")
                        .content(json.writeValueAsString(java.util.Map.of("name", "Brand API water", "brand", name.toUpperCase(),
                                "unit", "Bình", "salePrice", 50000))))
                .andExpect(status().isCreated()).andReturn();
        long viaApi = json.readTree(saved.getResponse().getContentAsString()).get("id").asLong();
        assertThat(brandOf(viaApi)).isEqualTo(id);

        // Trùng tên/tên gọi khác của thương hiệu khác thì bị từ chối.
        mvc.perform(post("/api/v1/brands").with(as("ADMIN")).contentType("application/json")
                .content("{\"name\":\"Khác\",\"aliases\":[\"" + name.toLowerCase() + "\"]}")).andExpect(status().isConflict());
        // Nhân viên chỉ xem.
        mvc.perform(get("/api/v1/brands").with(as("SALES_STAFF"))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/brands").with(as("SALES_STAFF")).contentType("application/json")
                .content("{\"name\":\"Không được\"}")).andExpect(status().isForbidden());

        // Đổi tên giữ tên cũ làm tên gọi khác; sản phẩm vẫn thuộc thương hiệu.
        mvc.perform(put("/api/v1/brands/" + id).with(as("ADMIN")).contentType("application/json")
                        .content(json.writeValueAsString(java.util.Map.of("name", name + " Mới", "aliases", List.of()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aliases").value(org.hamcrest.Matchers.hasItem(name.toLowerCase())))
                .andExpect(jsonPath("$.productCount").value(1));
        assertThat(brandOf(viaApi)).isEqualTo(id);
        assertThat(brandOf(byAlias)).isNull();

        mvc.perform(delete("/api/v1/brands/" + id).with(as("ADMIN"))).andExpect(status().isConflict());
        jdbc.update("UPDATE products SET brand_id=NULL WHERE brand_id=?", id);
        mvc.perform(delete("/api/v1/brands/" + id).with(as("ADMIN"))).andExpect(status().isNoContent());
    }

    @Test void migrationSeedsStandardBrands() throws Exception {
        mvc.perform(get("/api/v1/brands").with(as("ADMIN"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name=='LaVie')].aliases[*]").value(org.hamcrest.Matchers.hasItem("viva")));
    }
}
