import { useEffect } from 'react'
import { Button, Card, Empty, Skeleton } from 'antd'
import { ShoppingCart } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/shared/api/client'
import { QueryError } from '@/shared/components/QueryError'
import { articleBlocks, articleDate } from '@/features/articles/articleApi'
import { useArticle, usePublishedArticles } from '@/features/articles/useArticles'
import { ArticleIcon } from '@/features/articles/articleIcons'

/** Trang đọc bài tin tức (`/shop/news/:slug`) hoặc chính sách (`/shop/policy/:slug`). */
export function ArticlePage({ kind = 'news' }: { kind?: 'news' | 'policy' }) {
  const { slug = '' } = useParams()
  const query = useArticle(slug)
  const list = usePublishedArticles(kind === 'policy' ? 'POLICY' : 'NEWS')
  // Bài thuộc loại khác (link tin mở bằng đường dẫn chính sách) coi như không có, để mỗi bài chỉ có một địa chỉ.
  const article = query.data && query.data.kind === (kind === 'policy' ? 'POLICY' : 'NEWS') ? query.data : undefined

  useEffect(() => {
    if (article) document.title = `${article.title} | AquaFlow`
    window.scrollTo(0, 0)
  }, [article])

  if (query.isPending) {
    return (
      <div className="af-shop-page af-shop-narrow">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    )
  }
  if (query.isError && !(query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <div className="af-shop-page af-shop-narrow">
        <Card>
          <QueryError error={query.error} onRetry={query.refetch} />
        </Card>
      </div>
    )
  }
  if (!article) {
    return (
      <div className="af-shop-page af-shop-narrow">
        <Card>
          <Empty description="Không tìm thấy bài viết.">
            <Link to="/shop">
              <Button type="primary">Về trang chủ</Button>
            </Link>
          </Empty>
        </Card>
      </div>
    )
  }
  const others = (list.data ?? []).filter((item) => item.slug !== article.slug).slice(0, 3)
  return (
    <div className="af-shop-page af-shop-narrow af-shop-article">
      <article>
        <div className="af-shop-article-cover" aria-hidden>
          <ArticleIcon name={article.icon} size={56} strokeWidth={1.4} />
        </div>
        <h1>{article.title}</h1>
        {article.publishedOn && <time dateTime={article.publishedOn}>{articleDate(article.publishedOn)}</time>}
        <p className="af-shop-article-lead">{article.summary}</p>
        {articleBlocks(article.body ?? '').map((block, index) =>
          block.kind === 'heading' ? <h2 key={index}>{block.text}</h2> : <p key={index}>{block.text}</p>,
        )}
        <Link to="/shop">
          <Button type="primary" icon={<ShoppingCart size={16} />}>
            Đặt nước ngay
          </Button>
        </Link>
      </article>
      {others.length > 0 && (
        <section className="af-shop-article-more" aria-labelledby="af-shop-more-title">
          <h2 id="af-shop-more-title">{kind === 'policy' ? 'Chính sách khác' : 'Bài viết khác'}</h2>
          <ul>
            {others.map((item) => (
              <li key={item.slug}>
                <Link to={`/shop/${kind}/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
