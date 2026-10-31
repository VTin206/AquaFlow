import { Button } from 'antd'
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
import { DEPOSIT_PER_BOTTLE, FREE_DELIVERY_MIN_UNITS } from '@/shared/policy'
import { currency } from '@/shared/utils/format'
import { articleDate, shopArticles } from '../shopNews'
import type { ShopProduct } from '../shopService'

type Props = {
  demo: boolean
  storeName?: string
  phone?: string
  products: ShopProduct[]
  onShop: () => void
}

/**
 * Phần giới thiệu trước danh mục: banner kèm tin mới, ưu đãi, lý do chọn và cách đặt hàng.
 * Con số chính sách (miễn phí giao, cọc vỏ) chỉ hiện ở bản dùng thử vì BE chưa có cấu hình cửa hàng.
 */
export function ShopIntro({ demo, storeName, phone, products, onShop }: Props) {
  const showcase = products.filter((product) => product.image && product.available !== false).slice(0, 3)
  const tel = phone?.replace(/\s/g, '')

  const promos = demo
    ? [
        {
          icon: <Truck size={20} />,
          title: `Miễn phí giao từ ${FREE_DELIVERY_MIN_UNITS} bình/thùng`,
          text: 'Áp dụng cho mọi khu vực cửa hàng giao.',
        },
        { icon: <Recycle size={20} />, title: `Cọc vỏ ${currency(DEPOSIT_PER_BOTTLE)}`, text: 'Hoàn lại đầy đủ khi bạn trả vỏ bình.' },
        { icon: <PackageSearch size={20} />, title: 'Theo dõi đơn trực tuyến', text: 'Xem trạng thái đơn bằng mã tra cứu.' },
      ]
    : [
        { icon: <Truck size={20} />, title: 'Giao tận nơi', text: 'Bình 19L, thùng chai giao tới nhà, văn phòng.' },
        { icon: <UserRoundCheck size={20} />, title: 'Không cần tài khoản', text: 'Chỉ cần tên, số điện thoại và địa chỉ.' },
        { icon: <Phone size={20} />, title: 'Cửa hàng gọi xác nhận', text: 'Nhân viên liên hệ để chốt giờ giao.' },
      ]

  return (
    <div className="af-shop-intro">
      <div className="af-shop-top">
        <section className="af-shop-banner" aria-labelledby="af-shop-banner-title">
          <div className="af-shop-banner-copy">
            <span className="af-shop-eyebrow">
              <Droplets size={14} aria-hidden /> {storeName ?? 'Cửa hàng nước uống'}
            </span>
            <h1 id="af-shop-banner-title">
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
              ) : demo ? (
                <Link to="/track">
                  <Button size="large" ghost icon={<PackageSearch size={18} />}>
                    Tra cứu đơn
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
          <div className={`af-shop-banner-art ${showcase.length ? '' : 'is-empty'}`} aria-hidden>
            <span className="af-shop-bubble is-a" />
            <span className="af-shop-bubble is-b" />
            <span className="af-shop-bubble is-c" />
            {showcase.length ? (
              showcase.map((product, index) => (
                <img key={product.id} src={product.image} alt="" className={`af-shop-banner-item is-${index}`} loading="lazy" />
              ))
            ) : (
              <Droplets size={120} strokeWidth={1.2} className="af-shop-banner-drop" />
            )}
          </div>
        </section>
        <aside className="af-shop-news" aria-labelledby="af-shop-news-title">
          <h2 id="af-shop-news-title">Tin mới cập nhật</h2>
          <ul>
            {shopArticles.map((article) => {
              const Icon = article.icon
              return (
                <li key={article.slug}>
                  <Link to={`/shop/news/${article.slug}`}>
                    <span className="af-shop-news-thumb" aria-hidden>
                      <Icon size={24} />
                    </span>
                    <span className="af-shop-news-text">
                      <strong>{article.title}</strong>
                      {article.publishedOn && <small>{articleDate(article.publishedOn)}</small>}
                    </span>
                  </Link>
                </li>
              )
            })}
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
