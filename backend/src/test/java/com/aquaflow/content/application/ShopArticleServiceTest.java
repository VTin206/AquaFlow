package com.aquaflow.content.application;

import com.aquaflow.content.api.dto.ShopArticleRequest;
import com.aquaflow.content.domain.ShopArticle;
import com.aquaflow.content.domain.ShopArticleKind;
import com.aquaflow.content.repository.ShopArticleRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShopArticleServiceTest {
    /** 23h ngày 14/11 giờ UTC là 6h sáng 15/11 giờ Việt Nam. */
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-14T23:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private ShopArticleRepository repository;
    private ShopArticleService service;

    @BeforeEach
    void setUp() {
        repository = mock(ShopArticleRepository.class);
        when(repository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        service = new ShopArticleService(repository, CLOCK);
    }

    @Test
    void slugDropsVietnameseMarksAndPunctuation() {
        assertThat(ShopArticleService.slugOf("Bình úp hay bình vòi: chọn loại nào?")).isEqualTo("binh-up-hay-binh-voi-chon-loai-nao");
        assertThat(ShopArticleService.slugOf("Đổi vỏ ĐÚNG hạn")).isEqualTo("doi-vo-dung-han");
        assertThat(ShopArticleService.slugOf("  !!! ")).isEqualTo("bai-viet");
    }

    @Test
    void longSlugIsCutAtAWordBoundaryLeavingRoomForASuffix() {
        String slug = ShopArticleService.slugOf("nuoc ".repeat(40));
        assertThat(slug.length()).isLessThanOrEqualTo(ShopArticle.SLUG_MAX_LENGTH - 4);
        assertThat(slug).doesNotEndWith("-").endsWith("nuoc");
    }

    @Test
    void bodyKeepsParagraphsButDropsTrailingSpacesAndExtraBlankLines() {
        assertThat(ShopArticleService.normalizeBody("  Đoạn 1   \r\n\r\n\r\n\r\n## Tiêu đề\t\nĐoạn 2  \n"))
                .isEqualTo("Đoạn 1\n\n## Tiêu đề\nĐoạn 2");
    }

    @Test
    void generatedSlugGetsANumberWhenTaken() {
        when(repository.existsBySlug("coc-vo")).thenReturn(true);
        when(repository.existsBySlug("coc-vo-2")).thenReturn(true);

        var created = service.create(request(ShopArticleKind.NEWS, "", "Cọc vỏ", true, null, null));

        assertThat(created.slug()).isEqualTo("coc-vo-3");
    }

    @Test
    void publishedNewsWithoutDateUsesTheStoreDayAndPoliciesNeverHaveADate() {
        var news = service.create(request(ShopArticleKind.NEWS, null, "Tin", true, null, null));
        var draft = service.create(request(ShopArticleKind.NEWS, null, "Nháp", false, null, null));
        var policy = service.create(request(ShopArticleKind.POLICY, null, "Chính sách", true, LocalDate.of(2026, 1, 1), null));

        assertThat(news.publishedOn()).isEqualTo(LocalDate.of(2026, 11, 15));
        assertThat(draft.publishedOn()).isNull();
        assertThat(policy.publishedOn()).isNull();
    }

    @Test
    void rejectsUnknownIconMissingKindAndTakenSlug() {
        var badIcon = new ShopArticleRequest(ShopArticleKind.NEWS, null, "Tin", "Tóm tắt", "rocket", "Nội dung", true, null, null);
        assertThatThrownBy(() -> service.create(badIcon)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(request(null, null, "Tin", true, null, null))).isInstanceOf(BadRequestException.class);

        when(repository.existsBySlug("da-co")).thenReturn(true);
        assertThatThrownBy(() -> service.create(request(ShopArticleKind.NEWS, "da-co", "Tin", true, null, null)))
                .isInstanceOf(ConflictException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void updateRequiresTheVersionThatWasRead() {
        ShopArticle stored = new ShopArticle(ShopArticleKind.NEWS);
        stored.edit("tin", "Tin", "Tóm tắt", "newspaper", "Nội dung", true, LocalDate.of(2026, 11, 1));
        when(repository.findById(7L)).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.update(7L, request(ShopArticleKind.NEWS, "tin", "Tin", true, null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.update(7L, request(ShopArticleKind.NEWS, "tin", "Tin", true, null, 3L)))
                .isInstanceOf(ConflictException.class);

        when(repository.existsBySlugAndIdNot(eq("tin"), eq(7L))).thenReturn(false);
        var updated = service.update(7L, request(ShopArticleKind.POLICY, "tin", "Tin sửa", false, LocalDate.of(2026, 11, 1), 0L));
        // Không đổi loại khi sửa; ẩn bài vẫn giữ ngày đã đăng.
        assertThat(updated.kind()).isEqualTo(ShopArticleKind.NEWS);
        assertThat(updated.title()).isEqualTo("Tin sửa");
        assertThat(updated.published()).isFalse();
        assertThat(updated.publishedOn()).isEqualTo(LocalDate.of(2026, 11, 1));
        verify(repository, never()).existsBySlug(anyString());
    }

    private static ShopArticleRequest request(ShopArticleKind kind, String slug, String title, boolean published,
                                              LocalDate publishedOn, Long version) {
        return new ShopArticleRequest(kind, slug, title, "Tóm tắt", "newspaper", "Nội dung", published, publishedOn, version);
    }
}
