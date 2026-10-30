import { useEffect } from 'react'
import { Button, Card, Empty } from 'antd'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { articleDate, findArticle, shopArticles } from './shopNews'

export function ArticlePage() {
  const { slug = '' } = useParams()
  const article = findArticle(slug)

  useEffect(() => {
    if (article) document.title = `${article.title} | AquaFlow`
    window.scrollTo(0, 0)
  }, [article])

  if (!article) {
    return <div className="af-shop-page af-shop-narrow">
      <Card><Empty description="Không tìm thấy bài viết."><Link to="/shop"><Button type="primary">Về trang chủ</Button></Link></Empty></Card>
    </div>
  }
  const Icon = article.icon
  const others = shopArticles.filter((item) => item.slug !== article.slug).slice(0, 3)
  return <div className="af-shop-page af-shop-narrow af-shop-article">
    <Link to="/shop" className="af-text-link"><ArrowLeft size={14} /> Trang chủ</Link>
    <article>
      <div className="af-shop-article-cover" aria-hidden><Icon size={56} strokeWidth={1.4} /></div>
      <h1>{article.title}</h1>
      <time dateTime={article.publishedOn}>{articleDate(article.publishedOn)}</time>
      <p className="af-shop-article-lead">{article.summary}</p>
      {article.body.map((paragraph) => paragraph.startsWith('## ')
        ? <h2 key={paragraph}>{paragraph.slice(3)}</h2>
        : <p key={paragraph}>{paragraph}</p>)}
      <Link to="/shop"><Button type="primary" icon={<ShoppingCart size={16} />}>Đặt nước ngay</Button></Link>
    </article>
    <section className="af-shop-article-more" aria-labelledby="af-shop-more-title">
      <h2 id="af-shop-more-title">Bài viết khác</h2>
      <ul>
        {others.map((item) => <li key={item.slug}><Link to={`/shop/news/${item.slug}`}>{item.title}</Link></li>)}
      </ul>
    </section>
  </div>
}
