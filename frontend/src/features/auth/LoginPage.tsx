import { useState } from 'react'
import { Alert, App, Button, ConfigProvider, Divider, Form, Input, Modal } from 'antd'
import { ArrowRight, CircleCheck, Headphones, LockKeyhole, Package, Store, Truck, UserRound, Waves } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import './login.css'

export function LoginPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <div className="af-login-page">
      <header className="af-login-header">
        <Link to="/" className="af-topbar-brand" aria-label="AquaFlow — Trang chủ">
          <span className="af-brand-mark"><Waves size={22} strokeWidth={2.2} /></span>
          <strong>AquaFlow</strong>
        </Link>
        <Button type="text" icon={<Headphones size={17} />} onClick={() => setHelpOpen(true)}>Hỗ trợ</Button>
      </header>

      <main className="af-login-main">
        <div className="af-login-card">
          <section className="af-login-intro" aria-labelledby="af-login-intro-title">
            <div className="af-login-eyebrow"><span /> QUẢN LÝ CỬA HÀNG NƯỚC</div>
            <h2 id="af-login-intro-title">Mỗi đơn hàng,<br />một dòng chảy<br /><span>thật nhịp nhàng.</span></h2>
            <p>Theo dõi đơn hàng, quản lý kho và điều phối giao nước trong một không gian làm việc.</p>

            <div className="af-login-flow" aria-label="Quy trình: tiếp nhận đơn, chuẩn bị hàng, giao đến khách">
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon"><Store size={21} /></span>
                <div><strong>Tiếp nhận đơn hàng</strong><small>Thông tin rõ ràng, dễ theo dõi</small></div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon"><Package size={21} /></span>
                <div><strong>Chuẩn bị hàng hóa</strong><small>Nắm bắt tồn kho ngay tại cửa hàng</small></div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon"><Truck size={21} /></span>
                <div><strong>Giao đến khách hàng</strong><small>Kết nối từng bước giao nhận</small></div>
                <ArrowRight size={18} className="af-login-flow-check" />
              </div>
            </div>
            <div className="af-login-intro-foot"><Waves size={19} /> Gọn việc quản lý. Trọn từng đơn hàng.</div>
          </section>

          <section className="af-login-form-panel" aria-labelledby="af-login-title">
            <div className="af-login-form-heading">
              <span className="af-login-lock"><LockKeyhole size={25} /></span>
              <p className="af-login-welcome">CHÀO MỪNG TRỞ LẠI</p>
              <h1 id="af-login-title">Đăng nhập AquaFlow</h1>
              <p>Truy cập không gian quản lý cửa hàng của bạn.</p>
            </div>

            <ConfigProvider theme={{ components: { Input: { controlHeightLG: 48, fontSizeLG: 14 }, Button: { controlHeightLG: 48, fontSizeLG: 14 } } }}>
              <Form
                name="login"
                layout="vertical"
                onFinish={() => message.info('Đăng nhập chưa được kết nối. Bạn có thể chọn “Xem bản dùng thử” để khám phá AquaFlow.')}
              >
                <Form.Item label="Tên đăng nhập" name="username" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên đăng nhập.' }]}>
                  <Input size="large" prefix={<UserRound size={17} aria-hidden />} placeholder="Nhập tên đăng nhập" autoComplete="username" autoCapitalize="none" spellCheck={false} />
                </Form.Item>
                <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}>
                  <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
                </Form.Item>
                <div className="af-login-form-options"><Button type="link" size="small" onClick={() => setHelpOpen(true)}>Quên mật khẩu?</Button></div>
                <Button type="primary" size="large" htmlType="submit" block icon={<ArrowRight size={18} />} iconPlacement="end">Đăng nhập</Button>
              </Form>
              <Divider plain><span className="af-login-divider-text">Khám phá AquaFlow</span></Divider>
              <Button block size="large" onClick={() => navigate('/')}>Xem bản dùng thử</Button>
            </ConfigProvider>
            <div className="af-login-preview-note">
              <Alert type="info" showIcon title="Giao diện mẫu · Chưa kết nối đăng nhập" />
            </div>
          </section>
        </div>
      </main>

      <footer className="af-login-footer"><span>AquaFlow · Hệ thống quản lý cửa hàng nước</span><span>Một cửa hàng. Một không gian quản lý.</span></footer>
      <Modal title="Hỗ trợ đăng nhập" open={helpOpen} centered onCancel={() => setHelpOpen(false)} footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Đã hiểu</Button>}>
        <p>Nếu bạn chưa có tài khoản hoặc quên mật khẩu, hãy liên hệ người quản trị cửa hàng để được hỗ trợ.</p>
        <Alert type="info" showIcon title="Đây là bản xem trước giao diện" description="Chức năng đăng nhập và khôi phục mật khẩu chưa khả dụng. Bạn có thể xem bản dùng thử mà không cần nhập tài khoản." />
      </Modal>
    </div>
  )
}
