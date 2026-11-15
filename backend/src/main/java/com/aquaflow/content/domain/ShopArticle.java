package com.aquaflow.content.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;

/** Bài viết trên trang khách: tin tức hoặc trang chính sách. Chỉ bài đã đăng mới hiện công khai. */
@Entity
@Table(name = "shop_articles")
public class ShopArticle {
    public static final int SLUG_MAX_LENGTH = 120;
    public static final int TITLE_MAX_LENGTH = 200;
    public static final int SUMMARY_MAX_LENGTH = 300;
    public static final int BODY_MAX_LENGTH = 20_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ShopArticleKind kind;

    @Column(nullable = false, length = SLUG_MAX_LENGTH)
    private String slug;

    @Column(nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(nullable = false, length = SUMMARY_MAX_LENGTH)
    private String summary;

    @Column(nullable = false, length = 40)
    private String icon;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false)
    private boolean published;

    @Column(name = "published_on")
    private LocalDate publishedOn;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected ShopArticle() {
    }

    public ShopArticle(ShopArticleKind kind) {
        this.kind = kind;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void edit(String slug, String title, String summary, String icon, String body, boolean published, LocalDate publishedOn) {
        this.slug = slug;
        this.title = title;
        this.summary = summary;
        this.icon = icon;
        this.body = body;
        this.published = published;
        this.publishedOn = publishedOn;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public ShopArticleKind getKind() { return kind; }
    public String getSlug() { return slug; }
    public String getTitle() { return title; }
    public String getSummary() { return summary; }
    public String getIcon() { return icon; }
    public String getBody() { return body; }
    public boolean isPublished() { return published; }
    public LocalDate getPublishedOn() { return publishedOn; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
