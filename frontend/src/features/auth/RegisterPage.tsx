import { Button, ConfigProvider } from 'antd'
import { ArrowLeft, CircleCheck, History, MapPin, UserRoundPlus, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { RegisterForm } from './RegisterForm'
import './login.css'

/** Trang đăng ký tài khoản khách hàng; form và trạng thái "Chưa hỗ trợ" nằm trong `RegisterForm`. */
export function RegisterPage() {
  return (
    <div className="af-login-page">
      <header className="af-login-header">
        <Link to="/shop" className="af-topbar-brand" aria-label="AquaFlow — Về cửa hàng">
          <span className="af-brand-mark">
            <Waves size={22} strokeWidth={2.2} />
          </span>
          <strong>AquaFlow</strong>
        </Link>
        <div className="af-login-header-actions">
          <Link to="/shop">
            <Button type="text" icon={<ArrowLeft size={17} />}>
              Về cửa hàng
            </Button>
          </Link>
        </div>
      </header>

      <main className="af-login-main">
        <div className="af-login-card">
          <section className="af-login-intro" aria-labelledby="af-register-intro-title">
            <div className="af-login-eyebrow">
              <span /> TÀI KHOẢN KHÁCH HÀNG
            </div>
            <h2 id="af-register-intro-title">
              Đặt nước
              <br />
              nhanh hơn
              <br />
              <span>mỗi lần sau.</span>
            </h2>
            <p>Tạo tài khoản để không phải nhập lại thông tin giao hàng và theo dõi các đơn đã đặt.</p>
            <div className="af-login-flow" aria-label="Lợi ích khi có tài khoản">
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon">
                  <MapPin size={21} />
                </span>
                <div>
                  <strong>Lưu địa chỉ giao</strong>
                  <small>Chọn lại chỉ với một chạm</small>
                </div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon">
                  <History size={21} />
                </span>
                <div>
                  <strong>Xem lại đơn đã đặt</strong>
                  <small>Đặt lại đơn cũ nhanh chóng</small>
                </div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
            </div>
            <div className="af-login-intro-foot">
              <Waves size={19} /> Vẫn có thể đặt hàng không cần tài khoản.
            </div>
          </section>

          <section className="af-login-form-panel" aria-labelledby="af-register-title">
            <div className="af-login-form-heading">
              <span className="af-login-lock">
                <UserRoundPlus size={25} />
              </span>
              <p className="af-login-welcome">CHÀO MỪNG BẠN</p>
              <h1 id="af-register-title">Tạo tài khoản</h1>
              <p>Điền thông tin bên dưới để đăng ký.</p>
            </div>

            <ConfigProvider
              theme={{ components: { Input: { controlHeightLG: 48, fontSizeLG: 14 }, Button: { controlHeightLG: 48, fontSizeLG: 14 } } }}
            >
              <RegisterForm />
            </ConfigProvider>
            <p className="af-login-switch">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </section>
        </div>
      </main>

      <footer className="af-login-footer">
        <span>AquaFlow · Hệ thống quản lý cửa hàng nước</span>
        <span>Một cửa hàng. Một không gian quản lý.</span>
      </footer>
    </div>
  )
}
