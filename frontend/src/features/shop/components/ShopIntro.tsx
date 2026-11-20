import { Button, Carousel, Skeleton } from 'antd'
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Droplets,
  MapPin,
  PackageSearch,
  Phone,
  Recycle,
  ShoppingCart,
  Truck,
  UserRoundCheck,
} from 'lucide-react'
import { Link } from 'react-router'
import { articleDate } from '@/features/articles/articleApi'
import { usePublishedArticles } from '@/features/articles/useArticles'
import { ArticleIcon } from '@/features/articles/articleIcons'
import { productCutoutImage } from '@/features/inventory/productImages'
import type { ShopProduct } from '../shopService'

type Props = {
  phone?: string
  products: ShopProduct[]
  onShop: () => void
}

/**
 * Phần giới thiệu trước danh mục: banner kèm tin mới, ưu đãi, lý do chọn và cách đặt hàng.
 */
export function ShopIntro({ phone, products, onShop }: Props) {
  const withImage = products.filter((product) => product.image && product.available !== false)
  // Banner ưu tiên bình đã tách nền để ảnh nằm thẳng trên nền xanh; chưa có bản tách nền thì giữ ảnh gốc trong khung trắng.
  const cutouts = withImage.flatMap((product) => {
    const src = productCutoutImage(product.image)
    return src ? [{ id: product.id, name: product.name, src }] : []
  })
  const showcase = (
    cutouts.length ? cutouts : withImage.map((product) => ({ id: product.id, name: product.name, src: product.image }))
  ).slice(0, 9)
  const productSlides = showcase
  const tel = phone?.replace(/\s/g, '')
  const news = usePublishedArticles('NEWS')
  // Khung tin cạnh banner chỉ đủ chỗ cho vài bài mới nhất.
  const newsItems = (news.data ?? []).slice(0, 5)

  const promos = [
    { icon: <Truck size={20} />, title: 'Giao tận nơi', text: 'Bình 19L, thùng chai giao tới nhà, văn phòng.' },
    { icon: <UserRoundCheck size={20} />, title: 'Không cần tài khoản', text: 'Chỉ cần tên, số điện thoại và địa chỉ.' },
    { icon: <Phone size={20} />, title: 'Cửa hàng gọi xác nhận', text: 'Nhân viên liên hệ để chốt giờ giao.' },
  ]

  return (
    <div className="af-shop-intro">
      <div className="af-shop-top">
        <div className="af-shop-banner-slider" role="region" aria-label="Banner giới thiệu cửa hàng">
          <section className="af-shop-banner" aria-label="Giới thiệu cửa hàng">
            <div className="af-shop-banner-copy">
              <h1>
                Nước uống sạch
                <br />
                giao tận nhà
              </h1>
              <p>Bình 19L, nước suối đóng chai, nước khoáng từ các thương hiệu quen thuộc. Đặt vài bước, cửa hàng giao tới tận cửa.</p>
              <div className="af-shop-banner-actions">
                <Button type="primary" size="large" icon={<ShoppingCart size={18} />} onClick={onShop}>
                  Đặt nước ngay
                </Button>
                {tel ? (
                  <Button size="large" ghost icon={<Phone size={18} />} href={`tel:${tel}`}>
                    {phone}
                  </Button>
                ) : (
                  <Link to="/track">
                    <Button size="large" ghost icon={<PackageSearch size={18} />}>
                      Tra cứu đơn
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className={`af-shop-banner-art ${showcase.length ? '' : 'is-empty'}`}>
              <span className="af-shop-bubble is-a" aria-hidden />
              <span className="af-shop-bubble is-b" aria-hidden />
              <span className="af-shop-bubble is-c" aria-hidden />
              {showcase.length ? (
                <Carousel
                  className="af-shop-product-carousel"
                  autoplay={{ dotDuration: true }}
                  autoplaySpeed={3800}
                  speed={650}
                  effect="fade"
                  arrows
                  pauseOnHover={false}
                  pauseOnFocus={false}
                  pauseOnDotsHover={false}
                  infinite={productSlides.length > 1}
                >
                  {productSlides.map((product) => (
                    <div key={product.id} className="af-shop-product-slide">
                      {/* Bấm ảnh bình để mở trang chi tiết sản phẩm đó. */}
                      <Link to={`/shop/products/${encodeURIComponent(product.id)}`} title={`Xem ${product.name}`}>
                        <img
                          src={product.src}
                          alt={product.name}
                          className={`af-shop-product-item${cutouts.length ? ' is-cutout' : ''}`}
                          loading="lazy"
                        />
                      </Link>
                    </div>
                  ))}
                </Carousel>
              ) : (
                <Droplets size={120} strokeWidth={1.2} className="af-shop-banner-drop" aria-hidden />
              )}
            </div>
          </section>
        </div>
        <aside className="af-shop-news" aria-labelledby="af-shop-news-title">
          <h2 id="af-shop-news-title">Tin mới cập nhật</h2>
          {/* Khung tin luôn giữ chỗ để banner không nhảy bố cục khi tin tải xong hoặc chưa có tin. */}
          {news.isPending ? (
            <div className="af-shop-news-empty">
              <Skeleton active title={false} paragraph={{ rows: 4 }} />
            </div>
          ) : newsItems.length === 0 ? (
            <p className="af-shop-news-empty">Chưa có tin mới.</p>
          ) : null}
          <ul>
            {newsItems.map((article) => (
              <li key={article.slug}>
                <Link to={`/shop/news/${article.slug}`}>
                  <span className="af-shop-news-thumb" aria-hidden>
                    <ArticleIcon name={article.icon} size={24} />
                  </span>
                  <span className="af-shop-news-text">
                    <strong>{article.title}</strong>
                    {article.publishedOn && <small>{articleDate(article.publishedOn)}</small>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="af-shop-promos" aria-label="Ưu đãi">
        {promos.map((promo) => (
          <div key={promo.title} className="af-shop-promo">
            <span className="af-shop-promo-icon">{promo.icon}</span>
            <div>
              <strong>{promo.title}</strong>
              <small>{promo.text}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="af-shop-why" aria-labelledby="af-shop-why-title">
        <h2 id="af-shop-why-title">Vì sao chọn chúng tôi</h2>
        <div className="af-shop-why-grid">
          <div>
            <BadgeCheck size={22} aria-hidden />
            <strong>Rõ lô, rõ hạn</strong>
            <span>Hàng nhập theo lô, lô hạn gần được xuất trước.</span>
          </div>
          <div>
            <Droplets size={22} aria-hidden />
            <strong>Chính hãng</strong>
            <span>Nhập trực tiếp từ nhà cung cấp, có phiếu nhập.</span>
          </div>
          <div>
            <MapPin size={22} aria-hidden />
            <strong>Giao theo khu vực</strong>
            <span>Đơn được xếp chuyến theo tuyến để giao nhanh.</span>
          </div>
          <div>
            <Recycle size={22} aria-hidden />
            <strong>Đổi vỏ tiện lợi</strong>
            <span>Giao bình mới, thu vỏ cũ trong cùng lần giao.</span>
          </div>
        </div>
      </section>

      <section className="af-shop-steps" aria-labelledby="af-shop-steps-title">
        <h2 id="af-shop-steps-title">Đặt hàng trong 3 bước</h2>
        <ol>
          <li>
            <ShoppingCart size={20} aria-hidden />
            <div>
              <strong>Chọn sản phẩm</strong>
              <span>Thêm bình, thùng vào giỏ.</span>
            </div>
          </li>
          <li>
            <ClipboardList size={20} aria-hidden />
            <div>
              <strong>Nhập địa chỉ</strong>
              <span>Tên, số điện thoại, nơi giao.</span>
            </div>
          </li>
          <li>
            <Truck size={20} aria-hidden />
            <div>
              <strong>Nhận hàng</strong>
              <span>Cửa hàng xác nhận và giao tới.</span>
            </div>
          </li>
        </ol>
        <Button type="link" onClick={onShop}>
          Xem sản phẩm <ArrowRight size={14} />
        </Button>
      </section>
    </div>
  )
}
