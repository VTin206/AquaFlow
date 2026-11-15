package com.aquaflow.content.api;

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

/** Bài viết trang khách (V31) trên PostgreSQL thật, qua HTTP để kiểm cả phân quyền và nhật ký. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class ShopArticlePostgresIntegrationTest {

    private static final String PASSWORD = "correct-password";
    private static final String ADMIN_API = "/api/v1/admin/shop-articles";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper json;

    private String tag;
    private String adminToken;
    private String salesToken;

    @BeforeEach
    void setUp() throws Exception {
        tag = UUID.randomUUID().toString().substring(0, 8);
        adminToken = login(user("ADMIN"));
        salesToken = login(user("SALES_STAFF"));
    }

    @Test
    void migrationSeedsTheArticlesThatWereHardcodedInTheShop() throws Exception {
        JsonNode news = body(mvc.perform(get("/api/v1/shop-articles?kind=NEWS")).andExpect(status().isOk()));
        assertThat(news.findValuesAsText("slug")).containsSubsequence(
                "binh-up-hay-binh-voi", "bao-quan-binh-19l", "coc-vo-binh-la-gi", "nuoc-tinh-khiet-va-nuoc-khoang", "dat-nuoc-dinh-ky");
        assertThat(news.get(0).get("body").isNull()).isTrue();

        JsonNode policies = body(mvc.perform(get("/api/v1/shop-articles?kind=POLICY")).andExpect(status().isOk()));
        assertThat(policies.findValuesAsText("slug")).containsSubsequence("giao-hang", "coc-tra-vo", "doi-tra", "thanh-toan");

        mvc.perform(get("/api/v1/shop-articles/coc-tra-vo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("POLICY"))
                .andExpect(jsonPath("$.icon").value("recycle"))
                .andExpect(jsonPath("$.publishedOn").isEmpty())
                .andExpect(jsonPath("$.body").value(org.hamcrest.Matchers.startsWith("Khách chưa có vỏ")));
    }

    @Test
    void draftsStayHiddenUntilPublishedAndHidingRemovesThemAgain() throws Exception {
        JsonNode draft = body(send(post(ADMIN_API), adminToken, article("NEWS", "", "Khuyến mãi " + tag, false, null, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("khuyen-mai-" + tag))
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.publishedOn").isEmpty()));
        long id = draft.get("id").asLong();
        String slug = draft.get("slug").asText();

        mvc.perform(get("/api/v1/shop-articles/" + slug)).andExpect(status().isNotFound());
        assertThat(publicSlugs("NEWS")).doesNotContain(slug);

        JsonNode published = body(send(put(ADMIN_API + "/" + id), adminToken,
                article("NEWS", slug, "Khuyến mãi " + tag, true, "2099-01-01", draft.get("version").asLong()))
                .andExpect(status().isOk()));
        // Ngày đăng xa nhất nên đứng đầu danh sách tin.
        assertThat(publicSlugs("NEWS").get(0)).isEqualTo(slug);
        mvc.perform(get("/api/v1/shop-articles/" + slug))
                .andExpect(status().isOk()).andExpect(jsonPath("$.body").value("Đoạn 1\n## Tiêu đề\nĐoạn 2"));

        send(put(ADMIN_API + "/" + id), adminToken,
                article("NEWS", slug, "Khuyến mãi " + tag, false, "2099-01-01", published.get("version").asLong()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/shop-articles/" + slug)).andExpect(status().isNotFound());

        send(delete(ADMIN_API + "/" + id), adminToken, null).andExpect(status().isNoContent());
        send(delete(ADMIN_API + "/" + id), adminToken, null).andExpect(status().isNotFound());
    }

    @Test
    void staleVersionTakenSlugAndBadInputAreRejected() throws Exception {
        JsonNode created = body(send(post(ADMIN_API), adminToken, article("POLICY", "bao-hanh-" + tag, "Bảo hành", true, null, null))
                .andExpect(status().isCreated()));
        long id = created.get("id").asLong();
        long version = created.get("version").asLong();

        send(put(ADMIN_API + "/" + id), adminToken, article("POLICY", "bao-hanh-" + tag, "Bảo hành 2", true, null, version))
                .andExpect(status().isOk());
        // Người thứ hai vẫn giữ phiên bản cũ.
        send(put(ADMIN_API + "/" + id), adminToken, article("POLICY", "bao-hanh-" + tag, "Bảo hành 3", true, null, version))
                .andExpect(status().isConflict());

        send(post(ADMIN_API), adminToken, article("NEWS", "giao-hang", "Trùng", true, null, null)).andExpect(status().isConflict());
        send(post(ADMIN_API), adminToken, article("NEWS", "Có Dấu", "Sai đường dẫn", true, null, null)).andExpect(status().isBadRequest());
        send(post(ADMIN_API), adminToken, article("NEWS", null, "   ", true, null, null)).andExpect(status().isBadRequest());

        Map<String, Object> badIcon = fields("NEWS", null, "Icon lạ", true, null, null);
        badIcon.put("icon", "rocket");
        send(post(ADMIN_API), adminToken, json.writeValueAsString(badIcon)).andExpect(status().isBadRequest());
    }

    @Test
    void onlyAdminManagesArticlesAndChangesAreLogged() throws Exception {
        mvc.perform(get(ADMIN_API)).andExpect(status().isUnauthorized());
        send(get(ADMIN_API), salesToken, null).andExpect(status().isForbidden());
        send(post(ADMIN_API), salesToken, article("NEWS", null, "Không được", true, null, null)).andExpect(status().isForbidden());

        long id = body(send(post(ADMIN_API), adminToken, article("NEWS", null, "Nhật ký " + tag, false, null, null))
                .andExpect(status().isCreated())).get("id").asLong();
        assertThat(body(send(get(ADMIN_API), adminToken, null).andExpect(status().isOk())).findValuesAsText("title"))
                .contains("Nhật ký " + tag, "Chính sách giao hàng");

        Integer logged = jdbc.queryForObject(
                "SELECT count(*) FROM audit_logs WHERE entity_type='SHOP_ARTICLE' AND entity_id=? AND action='create'", Integer.class, id);
        assertThat(logged).isEqualTo(1);
        send(get("/api/v1/admin/activity-logs?area=SETTINGS&q=SHOP_ARTICLE"), adminToken, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].area").value("SETTINGS"));
    }

    private java.util.List<String> publicSlugs(String kind) throws Exception {
        return body(mvc.perform(get("/api/v1/shop-articles?kind=" + kind)).andExpect(status().isOk())).findValuesAsText("slug");
    }

    private String article(String kind, String slug, String title, boolean published, String publishedOn, Long version) throws Exception {
        return json.writeValueAsString(fields(kind, slug, title, published, publishedOn, version));
    }

    private Map<String, Object> fields(String kind, String slug, String title, boolean published, String publishedOn, Long version) {
        Map<String, Object> body = new HashMap<>();
        body.put("kind", kind);
        if (slug != null) body.put("slug", slug);
        body.put("title", title);
        body.put("summary", "Tóm tắt " + tag);
        body.put("icon", "megaphone");
        body.put("body", "Đoạn 1  \r\n## Tiêu đề\nĐoạn 2\n");
        body.put("published", published);
        if (publishedOn != null) body.put("publishedOn", publishedOn);
        if (version != null) body.put("version", version);
        return body;
    }

    private String user(String role) {
        jdbc.update("INSERT INTO roles(code,name) VALUES (?,?) ON CONFLICT (code) DO NOTHING", role, role);
        String email = tag + "-" + role.toLowerCase() + "@article.test";
        jdbc.update("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code=?),?,?,?)",
                role, "Tester " + tag, email, passwordEncoder.encode(PASSWORD));
        return email;
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String token, String body) throws Exception {
        request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
