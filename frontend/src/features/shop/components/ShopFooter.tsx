import { Mail, MapPin, Phone, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { shopArticles, shopPolicies } from '../shopNews'

type Props = {
  demo: boolean
  /** Cài đặt cửa hàng chỉ có ở bản dùng thử; tài khoản thật chưa có API nên ẩn phần liên hệ. */
  contact?: { storeName?: string; phone?: string; address?: string; email?: string }
}

export function ShopFooter({ demo, contact }: Props) {
  const tel = contact?.phone?.replace(/\s/g, '')
  const hasContact = Boolean(contact?.phone || contact?.address || contact?.email)
  const latest = shopArticles[0]

  return (
    <footer className="af-shop-footer">
      <div className={`af-shop-footer-grid ${hasContact ? 'has-contact' : ''}`}>
        <section className="af-shop-footer-about">
          <Link to="/shop" className="af-shop-brand">
            <span className="af-brand-mark"><Waves size={20} strokeWidth={2.2} /></span>
            <strong>AquaFlow</strong>
          </Link>
          <p>Nước uống đóng bình, đóng chai từ các thương hiệu quen thuộc, nhập theo lô rõ hạn dùng và giao tận nơi trong khu vực.</p>
        </section>
        <nav aria-labelledby="af-footer-info">
          <h2 id="af-footer-info">Góc thông tin</h2>
          <ul>
            <li><Link to="/shop">Sản phẩm</Link></li>
            {latest && <li><Link to={`/shop/news/${latest.slug}`}>Tin tức</Link></li>}
            <li><Link to="/track">Tra cứu đơn</Link></li>
            <li><Link to="/shop/account">Đăng nhập</Link></li>
            <li><Link to="/shop/register">Tạo tài khoản</Link></li>
            <li><Link to="/login">Đăng nhập cho nhân viên</Link></li>
          </ul>
        </nav>
        <nav aria-labelledby="af-footer-policy">
          <h2 id="af-footer-policy">Chính sách</h2>
          <ul>
            {shopPolicies.map((policy) => <li key={policy.slug}><Link to={`/shop/policy/${policy.slug}`}>{policy.title}</Link></li>)}
          </ul>
        </nav>
        {hasContact && (
          <section aria-labelledby="af-footer-contact">
            <h2 id="af-footer-contact">Liên hệ</h2>
            <ul className="af-shop-footer-contact">
              {contact?.storeName && <li><strong>{contact.storeName}</strong></li>}
              {contact?.address && <li><MapPin size={15} aria-hidden /> {contact.address}</li>}
              {tel && <li><Phone size={15} aria-hidden /> <a href={`tel:${tel}`}>{contact?.phone}</a></li>}
              {contact?.email && <li><Mail size={15} aria-hidden /> <a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
            </ul>
          </section>
        )}
      </div>
      <div className="af-shop-footer-bottom">
        <span>© {new Date().getFullYear()} AquaFlow</span>
        {demo && <small>Bản dùng thử: đơn chỉ lưu trong tab hiện tại và mất khi tải lại trang.</small>}
      </div>
    </footer>
  )
}
