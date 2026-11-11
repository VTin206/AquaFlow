import { ArrowRight, Clock3, Mail, MapPin, Phone, ShieldCheck, Truck } from 'lucide-react'
import { Link } from 'react-router'
import { shopArticles, shopPolicies } from '../shopNews'

type Props = {
  demo: boolean
  /** Thông tin liên hệ công khai (tài khoản thật lấy từ /store-profile); thiếu thì ẩn phần liên hệ. */
  contact?: { storeName?: string; phone?: string; address?: string; email?: string; openingHours?: string }
}

export function ShopFooter({ demo, contact }: Props) {
  const tel = contact?.phone?.replace(/\s/g, '')
  const hasContact = Boolean(contact?.phone || contact?.address || contact?.email)
  const latest = shopArticles[0]
  const openingHours = contact?.openingHours?.trim()

  return (
    <footer className="af-shop-footer">
      <div className="af-shop-footer-cta-wrap">
        <div className="af-shop-footer-cta-copy">
          <span className="af-shop-footer-kicker">AQUAFLOW DELIVERY</span>
          <h2>Nước sạch sẵn sàng cho mọi lịch trình.</h2>
          <p>Chọn sản phẩm yêu thích, đặt nhanh trong vài bước và nhận nước tận nơi.</p>
        </div>
        <Link to="/shop/drinks" className="af-shop-footer-cta">
          Xem nước uống <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
      <div className={`af-shop-footer-grid ${hasContact ? 'has-contact' : ''}`}>
        <section className="af-shop-footer-about">
          <div className="af-shop-footer-brand-shell">
            <Link to="/shop" className="af-shop-brand" aria-label="AquaFlow - Trang chủ cửa hàng">
              <img className="af-brand-logo" src="/images/aquaflow-logo.png" alt="AquaFlow" />
            </Link>
          </div>
          <p>Nước uống đóng bình, đóng chai từ các thương hiệu quen thuộc, nhập theo lô rõ hạn dùng và giao tận nơi trong khu vực.</p>
          <div className="af-shop-footer-trust" aria-label="Cam kết dịch vụ">
            <span><Truck size={15} aria-hidden /> Giao tận nơi</span>
            <span><ShieldCheck size={15} aria-hidden /> Nguồn hàng rõ ràng</span>
          </div>
        </section>
        <nav aria-labelledby="af-footer-info">
          <h2 id="af-footer-info">Góc thông tin</h2>
          <ul>
            <li>
              <Link to="/shop/drinks">Nước uống</Link>
            </li>
            {latest && (
              <li>
                <Link to={`/shop/news/${latest.slug}`}>Tin tức</Link>
              </li>
            )}
            <li>
              <Link to="/track">Tra cứu đơn</Link>
            </li>
            <li>
              <Link to="/shop/account">Đăng nhập</Link>
            </li>
            <li>
              <Link to="/shop/register">Tạo tài khoản</Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="af-footer-policy">
          <h2 id="af-footer-policy">Chính sách</h2>
          <ul>
            {shopPolicies.map((policy) => (
              <li key={policy.slug}>
                <Link to={`/shop/policy/${policy.slug}`}>{policy.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
        {hasContact && (
          <section aria-labelledby="af-footer-contact">
            <h2 id="af-footer-contact">Liên hệ</h2>
            <ul className="af-shop-footer-contact">
              {contact?.storeName && (
                <li>
                  <strong>{contact.storeName}</strong>
                </li>
              )}
              {contact?.address && (
                <li>
                  <MapPin size={15} aria-hidden /> {contact.address}
                </li>
              )}
              {tel && (
                <li>
                  <Phone size={15} aria-hidden /> <a href={`tel:${tel}`}>{contact?.phone}</a>
                </li>
              )}
              {contact?.email && (
                <li>
                  <Mail size={15} aria-hidden /> <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              )}
              {openingHours && (
                <li>
                  <Clock3 size={15} aria-hidden /> <span>{openingHours}</span>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
      <div className="af-shop-footer-bottom">
        <span>© {new Date().getFullYear()} AquaFlow</span>
        <span className="af-shop-footer-bottom-links">
          <Link to="/shop/policy/giao-hang">Giao hàng</Link>
          <Link to="/shop/policy/thanh-toan">Thanh toán</Link>
        </span>
        {demo && <small>Bản dùng thử: đơn chỉ lưu trong tab hiện tại và mất khi tải lại trang.</small>}
      </div>
    </footer>
  )
}
