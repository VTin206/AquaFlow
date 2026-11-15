package com.aquaflow.content.repository;

import com.aquaflow.content.domain.ShopArticle;
import com.aquaflow.content.domain.ShopArticleKind;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShopArticleRepository extends JpaRepository<ShopArticle, Long> {
    /** Tin đã đăng: mới nhất trước (ngày đăng, rồi bài thêm sau). */
    List<ShopArticle> findByKindAndPublishedTrueOrderByPublishedOnDescIdDesc(ShopArticleKind kind);

    /** Chính sách đã đăng theo thứ tự thêm, đúng thứ tự ở chân trang. */
    List<ShopArticle> findByKindAndPublishedTrueOrderByIdAsc(ShopArticleKind kind);

    Optional<ShopArticle> findBySlugAndPublishedTrue(String slug);

    /** Màn hình quản lý: tin trước chính sách, trong mỗi loại bài sửa gần nhất lên đầu. */
    List<ShopArticle> findAllByOrderByKindAscUpdatedAtDescIdDesc();

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);
}
