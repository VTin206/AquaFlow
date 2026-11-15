package com.aquaflow.content.application;

import com.aquaflow.content.api.dto.PublicShopArticle;
import com.aquaflow.content.api.dto.ShopArticleRequest;
import com.aquaflow.content.api.dto.ShopArticleResponse;
import com.aquaflow.content.domain.ShopArticle;
import com.aquaflow.content.domain.ShopArticleKind;
import com.aquaflow.content.repository.ShopArticleRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Tin tức và chính sách trên trang khách: chủ cửa hàng viết, đăng / ẩn, xóa; khách chỉ đọc bài đã đăng. */
@Service
public class ShopArticleService {
    /** Icon frontend vẽ được (tên icon lucide dạng kebab-case). Thêm icon thì thêm ở cả hai phía. */
    public static final Set<String> ICONS = Set.of(
            "newspaper", "megaphone", "gift", "glass-water", "droplets", "thermometer-sun", "recycle",
            "calendar-clock", "truck", "rotate-ccw", "wallet", "shield-check");

    private static final String FALLBACK_SLUG = "bai-viet";

    private final ShopArticleRepository repository;
    /** Giờ Việt Nam (ClockConfig): tin đăng lúc 0h–7h vẫn ghi đúng ngày của cửa hàng. */
    private final Clock clock;

    public ShopArticleService(ShopArticleRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PublicShopArticle> findPublished(ShopArticleKind kind) {
        List<ShopArticle> articles = kind == ShopArticleKind.NEWS
                ? repository.findByKindAndPublishedTrueOrderByPublishedOnDescIdDesc(kind)
                : repository.findByKindAndPublishedTrueOrderByIdAsc(kind);
        return articles.stream().map(article -> toPublic(article, false)).toList();
    }

    /** Bản nháp và bài không tồn tại đều trả 404 để khách không dò được bài chưa đăng. */
    @Transactional(readOnly = true)
    public PublicShopArticle findPublished(String slug) {
        return repository.findBySlugAndPublishedTrue(slug)
                .map(article -> toPublic(article, true))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bài viết."));
    }

    @Transactional(readOnly = true)
    public List<ShopArticleResponse> findAll() {
        return repository.findAllByOrderByKindAscUpdatedAtDescIdDesc().stream().map(ShopArticleService::toResponse).toList();
    }

    @Transactional
    public ShopArticleResponse create(ShopArticleRequest request) {
        if (request.kind() == null) {
            throw new BadRequestException("Chọn loại bài viết: tin tức hoặc chính sách");
        }
        ShopArticle article = new ShopArticle(request.kind());
        apply(article, request, null);
        return toResponse(save(article));
    }

    @Transactional
    public ShopArticleResponse update(Long id, ShopArticleRequest request) {
        if (request.version() == null) {
            throw new BadRequestException("Thiếu phiên bản bài viết; tải lại trang rồi sửa lại.");
        }
        ShopArticle article = getArticle(id);
        if (article.getVersion() != request.version()) {
            throw staleVersion();
        }
        apply(article, request, id);
        return toResponse(save(article));
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(getArticle(id));
    }

    private void apply(ShopArticle article, ShopArticleRequest request, Long id) {
        String icon = request.icon().trim();
        if (!ICONS.contains(icon)) {
            throw new BadRequestException("Icon không hợp lệ: " + icon);
        }
        String title = collapse(request.title());
        String slug = request.slug() == null || request.slug().isBlank()
                ? uniqueSlug(slugOf(title), id)
                : requireFreeSlug(request.slug(), id);
        boolean published = request.published();
        LocalDate publishedOn = article.getKind() == ShopArticleKind.POLICY ? null
                : request.publishedOn() == null && published ? LocalDate.now(clock) : request.publishedOn();
        article.edit(slug, title, collapse(request.summary()), icon, normalizeBody(request.body()), published, publishedOn);
    }

    /** Ghi ngay để lỗi phiên bản và trùng đường dẫn (hai người cùng lưu) trả 409 có lời giải thích thay vì 500. */
    private ShopArticle save(ShopArticle article) {
        try {
            return repository.saveAndFlush(article);
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw staleVersion();
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Đường dẫn " + article.getSlug() + " vừa được dùng cho bài khác. Đổi đường dẫn rồi lưu lại.");
        }
    }

    private String requireFreeSlug(String slug, Long id) {
        if (id == null ? repository.existsBySlug(slug) : repository.existsBySlugAndIdNot(slug, id)) {
            throw new ConflictException("Đường dẫn " + slug + " đã dùng cho bài khác.");
        }
        return slug;
    }

    /** Đường dẫn tự sinh trùng thì thêm -2, -3... */
    private String uniqueSlug(String base, Long id) {
        String candidate = base;
        for (int suffix = 2; id == null ? repository.existsBySlug(candidate) : repository.existsBySlugAndIdNot(candidate, id); suffix++) {
            String tail = "-" + suffix;
            candidate = base.substring(0, Math.min(base.length(), ShopArticle.SLUG_MAX_LENGTH - tail.length())).replaceAll("-+$", "") + tail;
        }
        return candidate;
    }

    /** "Bình úp hay bình vòi?" → "binh-up-hay-binh-voi". Không còn chữ hay số nào thì dùng "bai-viet". */
    static String slugOf(String title) {
        String ascii = Normalizer.normalize(title.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (slug.length() > ShopArticle.SLUG_MAX_LENGTH - 4) {
            // Chừa chỗ cho hậu tố chống trùng, cắt ở ranh giới từ.
            slug = slug.substring(0, ShopArticle.SLUG_MAX_LENGTH - 4).replaceAll("-[^-]*$", "");
        }
        return slug.isEmpty() ? FALLBACK_SLUG : slug;
    }

    static String collapse(String text) {
        return text.trim().replaceAll("\\s+", " ");
    }

    /** Bỏ khoảng trắng cuối dòng và dòng trống thừa; giữ một dòng trống giữa các đoạn nếu người viết dùng. */
    static String normalizeBody(String body) {
        return body.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("[ \\t]+\n", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .strip();
    }

    private ShopArticle getArticle(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Không tìm thấy bài viết: " + id));
    }

    private static ConflictException staleVersion() {
        return new ConflictException("Bài viết vừa được người khác sửa. Tải lại để xem bản mới rồi sửa lại.");
    }

    private static PublicShopArticle toPublic(ShopArticle article, boolean withBody) {
        return new PublicShopArticle(article.getKind(), article.getSlug(), article.getTitle(), article.getSummary(),
                article.getIcon(), article.getPublishedOn(), withBody ? article.getBody() : null);
    }

    private static ShopArticleResponse toResponse(ShopArticle article) {
        return new ShopArticleResponse(article.getId(), article.getKind(), article.getSlug(), article.getTitle(),
                article.getSummary(), article.getIcon(), article.getBody(), article.isPublished(), article.getPublishedOn(),
                article.getCreatedAt(), article.getUpdatedAt(), article.getVersion());
    }
}
