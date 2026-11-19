import { ArrowRight, Clock3, Mail, MapPin, Phone, ShieldCheck, Truck } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { loginReturnState } from '@/features/auth/accountAccess'
import { usePublishedArticles } from '@/features/articles/useArticles'

type Props = {
  /** Thông tin liên hệ công khai (lấy từ /store-profile); thiếu thì ẩn phần liên hệ. */
  contact?: { storeName?: string; phone?: string; address?: string; email?: string; openingHours?: string }
}

export function ShopFooter({ contact }: Props) {
  const tel = contact?.phone?.replace(/\s/g, '')
  const hasContact = Boolean(contact?.phone || contact?.address || contact?.email)
  // Lỗi tải thì chỉ ẩn link bài viết; chân trang vẫn hiện liên hệ và các link khác.
  const latest = usePublishedArticles('NEWS').data?.[0]
  const policies = usePublishedArticles('POLICY').data ?? []
  const openingHours = contact?.openingHours?.trim()
  // Đăng nhập/đăng ký xong quay lại trang đang xem.
  const returnState = loginReturnState(useLocation())

  return (
    <footer className="af-shop-footer">
      <div className="af-shop-footer-cta-wrap">
        <div className="af-shop-footer-cta-copy">
          <span className="af-shop-footer-kicker">AQUAFLOW DELIVERY</span>
          <h2>Nước sạch sẵn sàng cho mọi lịch trình.</h2>
          <p>Chọn sản phẩm yêu thích, đặt nhanh trong vài bước và nhận nước tận nơi.</p>
        </div>
        <Link to="/shop/drinks" className="af-shop-footer-cta">
          Xem sản phẩm <ArrowRight size={17} aria-hidden />
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
            <span>
              <Truck size={15} aria-hidden /> Giao tận nơi
            </span>
            <span>
              <ShieldCheck size={15} aria-hidden /> Nguồn hàng rõ ràng
            </span>
          </div>
        </section>
        <nav aria-labelledby="af-footer-info">
          <h2 id="af-footer-info">Góc thông tin</h2>
          <ul>
            <li>
              <Link to="/shop/drinks">Sản phẩm</Link>
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
              <Link to="/shop/account" state={returnState}>
                Đăng nhập
              </Link>
            </li>
            <li>
              <Link to="/shop/register" state={returnState}>
                Tạo tài khoản
              </Link>
            </li>
          </ul>
        </nav>
        {policies.length > 0 && (
          <nav aria-labelledby="af-footer-policy">
            <h2 id="af-footer-policy">Chính sách</h2>
            <ul>
              {policies.map((policy) => (
                <li key={policy.slug}>
                  <Link to={`/shop/policy/${policy.slug}`}>{policy.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {hasContact && (
          // id "lien-he": mục "Liên hệ" trên menu cuộn tới đây.
          <section id="lien-he" aria-labelledby="af-footer-contact">
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
      </div>
    </footer>
  )
}
