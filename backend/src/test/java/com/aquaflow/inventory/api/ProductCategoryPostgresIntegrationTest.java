package com.aquaflow.inventory.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Loại sản phẩm (V29) và mã sản phẩm tự sinh trên PostgreSQL thật, qua HTTP để kiểm cả phân quyền. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class ProductCategoryPostgresIntegrationTest {

    private static final String PASSWORD = "correct-password";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper json;

    private String tag;
    private String staffToken;

    @BeforeEach
    void setUp() throws Exception {
        tag = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('SALES_STAFF','Sales') ON CONFLICT (code) DO NOTHING");
        String email = tag + "-sales@category.test";
        jdbc.update("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='SALES_STAFF'),?,?,?)",
                "Tester " + tag, email, passwordEncoder.encode(PASSWORD));
        staffToken = login(email);
    }

    @Test
    void migrationSeedsTheFormerWaterTypesInFilterOrder() {
        var names = jdbc.queryForList("SELECT name FROM product_categories WHERE id <= 7 ORDER BY id", String.class);
        assertThat(names).containsExactly("Tinh khiết", "Nước khoáng", "Ion kiềm", "Hoàn lưu khoáng", "Nước có ga",
                "Bù khoáng & điện giải", "Vỏ bình & phụ kiện");
    }

    @Test
    void staffAddAndRenameCategoriesAndNamesAreUniqueIgnoringCaseAndSpaces() throws Exception {
        long id = body(send(post("/api/v1/product-categories"), category("  Nước  tăng lực " + tag + " ", null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Nước tăng lực " + tag))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.productCount").value(0))).get("id").asLong();

        send(post("/api/v1/product-categories"), category("NƯỚC TĂNG LỰC " + tag.toUpperCase(), null)).andExpect(status().isConflict());
        send(post("/api/v1/product-categories"), category("   ", null)).andExpect(status().isBadRequest());

        send(put("/api/v1/product-categories/" + id), category("Nước uống thể thao " + tag, null))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Nước uống thể thao " + tag));
        // Đổi sang tên đã có (loại có sẵn từ migration) bị từ chối; đổi hoa thường tên chính nó thì được.
        send(put("/api/v1/product-categories/" + id), category("tinh khiết", null)).andExpect(status().isConflict());
        send(put("/api/v1/product-categories/" + id), category("NƯỚC UỐNG THỂ THAO " + tag, null)).andExpect(status().isOk());

        JsonNode list = body(send(get("/api/v1/product-categories"), null).andExpect(status().isOk()));
        assertThat(list.findValuesAsText("name")).contains("NƯỚC UỐNG THỂ THAO " + tag, "Tinh khiết");
    }

    @Test
    void categoryWithProductsCannotBeDeletedButCanBeRetiredAndProductsKeepIt() throws Exception {
        long id = body(send(post("/api/v1/product-categories"), category("Nước có vị " + tag, null))
                .andExpect(status().isCreated())).get("id").asLong();
        long product = body(send(post("/api/v1/products"), product("VI-" + tag, id)).andExpect(status().isCreated())).get("id").asLong();

        send(delete("/api/v1/product-categories/" + id), null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("còn 1 sản phẩm")));

        send(put("/api/v1/product-categories/" + id), category("Nước có vị " + tag, false))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false)).andExpect(jsonPath("$.productCount").value(1));
        // Ngừng dùng: không gán được cho sản phẩm khác, sản phẩm đang thuộc loại này vẫn giữ.
        send(post("/api/v1/products"), product("VI2-" + tag, id)).andExpect(status().isConflict());
        send(put("/api/v1/products/" + product), productUpdate(id)).andExpect(status().isOk()).andExpect(jsonPath("$.categoryId").value(id));
        assertThat(body(send(get("/api/v1/product-categories?active=true"), null)).findValuesAsText("name")).doesNotContain("Nước có vị " + tag);

        send(put("/api/v1/products/" + product), productUpdate(0L)).andExpect(status().isOk()).andExpect(jsonPath("$.categoryId").isEmpty());
        send(delete("/api/v1/product-categories/" + id), null).andExpect(status().isNoContent());
        send(delete("/api/v1/product-categories/" + id), null).andExpect(status().isNotFound());
    }

    @Test
    void blankSkuGetsAGeneratedCode() throws Exception {
        String first = body(send(post("/api/v1/products"), product("", null)).andExpect(status().isCreated())).get("sku").asText();
        String second = body(send(post("/api/v1/products"), product(null, null)).andExpect(status().isCreated())).get("sku").asText();

        assertThat(first).matches("SP\\d{5,}");
        assertThat(second).matches("SP\\d{5,}").isNotEqualTo(first);
    }

    @Test
    void categoryApiIsOnlyForStoreStaff() throws Exception {
        mvc.perform(get("/api/v1/product-categories")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/product-categories").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\"}"))
                .andExpect(status().isUnauthorized());
    }

    private String category(String name, Boolean active) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        if (active != null) body.put("active", active);
        return json.writeValueAsString(body);
    }

    private String product(String sku, Long categoryId) throws Exception {
        Map<String, Object> body = new HashMap<>();
        if (sku != null) body.put("sku", sku);
        body.put("name", "Nước " + tag);
        body.put("unit", "Chai");
        body.put("salePrice", 10000);
        if (categoryId != null) body.put("categoryId", categoryId);
        return json.writeValueAsString(body);
    }

    private String productUpdate(Long categoryId) throws Exception {
        return json.writeValueAsString(Map.of("name", "Nước " + tag, "unit", "Chai", "salePrice", 10000, "categoryId", categoryId));
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String body) throws Exception {
        request.header(HttpHeaders.AUTHORIZATION, "Bearer " + staffToken);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
