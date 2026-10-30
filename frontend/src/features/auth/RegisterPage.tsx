import { Alert, Button, Checkbox, ConfigProvider, Form, Input, Tooltip } from 'antd'
import { ArrowLeft, CircleCheck, History, LockKeyhole, Mail, MapPin, Phone, UserRound, UserRoundPlus, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { UNSUPPORTED_HINT } from '../../shared/components/Unsupported'
import './login.css'

type RegisterForm = { fullName: string; phone: string; email: string; password: string; confirm: string; agree: boolean }

/**
 * Đăng ký tài khoản khách hàng. BE chưa có API đăng ký (AuthController chỉ có login, me) nên
 * form giữ bố cục và kiểm tra dữ liệu, còn nút gửi bị khóa "Chưa hỗ trợ". Khi có API thì nối vào `onFinish`.
 */
export function RegisterPage() {
  const [form] = Form.useForm<RegisterForm>()

  return (
    <div className="af-login-page">
      <header className="af-login-header">
        <Link to="/shop" className="af-topbar-brand" aria-label="AquaFlow — Về cửa hàng">
          <span className="af-brand-mark"><Waves size={22} strokeWidth={2.2} /></span>
          <strong>AquaFlow</strong>
        </Link>
        <div className="af-login-header-actions">
          <Link to="/shop"><Button type="text" icon={<ArrowLeft size={17} />}>Về cửa hàng</Button></Link>
        </div>
      </header>

      <main className="af-login-main">
        <div className="af-login-card">
          <section className="af-login-intro" aria-labelledby="af-register-intro-title">
            <div className="af-login-eyebrow"><span /> TÀI KHOẢN KHÁCH HÀNG</div>
            <h2 id="af-register-intro-title">Đặt nước<br />nhanh hơn<br /><span>mỗi lần sau.</span></h2>
            <p>Tạo tài khoản để không phải nhập lại thông tin giao hàng và theo dõi các đơn đã đặt.</p>
            <div className="af-login-flow" aria-label="Lợi ích khi có tài khoản">
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon"><MapPin size={21} /></span>
                <div><strong>Lưu địa chỉ giao</strong><small>Chọn lại chỉ với một chạm</small></div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
              <div className="af-login-flow-item">
                <span className="af-login-flow-icon"><History size={21} /></span>
                <div><strong>Xem lại đơn đã đặt</strong><small>Đặt lại đơn cũ nhanh chóng</small></div>
                <CircleCheck size={18} className="af-login-flow-check" />
              </div>
            </div>
            <div className="af-login-intro-foot"><Waves size={19} /> Vẫn có thể đặt hàng không cần tài khoản.</div>
          </section>

          <section className="af-login-form-panel" aria-labelledby="af-register-title">
            <div className="af-login-form-heading">
              <span className="af-login-lock"><UserRoundPlus size={25} /></span>
              <p className="af-login-welcome">CHÀO MỪNG BẠN</p>
              <h1 id="af-register-title">Tạo tài khoản</h1>
              <p>Điền thông tin bên dưới để đăng ký.</p>
            </div>

            <ConfigProvider theme={{ components: { Input: { controlHeightLG: 48, fontSizeLG: 14 }, Button: { controlHeightLG: 48, fontSizeLG: 14 } } }}>
              <Form form={form} name="register" layout="vertical" requiredMark={false} autoComplete="on">
                <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 150, message: 'Tối đa 150 ký tự.' }]}>
                  <Input size="large" prefix={<UserRound size={17} aria-hidden />} placeholder="Nguyễn Văn An" autoComplete="name" />
                </Form.Item>
                <Form.Item label="Số điện thoại" name="phone" rules={[{ required: true, message: 'Nhập số điện thoại.' }, { pattern: /^(?:0\d{9,10}|\+?84\d{9,10})$/, message: 'Số điện thoại không hợp lệ.' }]}>
                  <Input size="large" prefix={<Phone size={17} aria-hidden />} placeholder="0901 234 567" autoComplete="tel" inputMode="tel" />
                </Form.Item>
                <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
                  <Input type="email" size="large" prefix={<Mail size={17} aria-hidden />} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
                </Form.Item>
                <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu.' }, { min: 8, max: 128, message: 'Mật khẩu có từ 8 đến 128 ký tự.' }]}>
                  <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Ít nhất 8 ký tự" autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  label="Nhập lại mật khẩu"
                  name="confirm"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Nhập lại mật khẩu.' },
                    ({ getFieldValue }) => ({ validator: (_, value) => (!value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Mật khẩu nhập lại không khớp.'))) }),
                  ]}
                >
                  <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="agree" valuePropName="checked" rules={[{ validator: (_, value) => (value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với điều khoản.'))) }]}>
                  <Checkbox>Tôi đồng ý với điều khoản sử dụng của cửa hàng</Checkbox>
                </Form.Item>
                <Tooltip title={UNSUPPORTED_HINT}>
                  {/* span giữ tooltip khi nút bị khóa */}
                  <span style={{ display: 'block' }}>
                    <Button type="primary" size="large" htmlType="submit" block disabled icon={<UserRoundPlus size={18} />}>Tạo tài khoản (chưa hỗ trợ)</Button>
                  </span>
                </Tooltip>
              </Form>
            </ConfigProvider>
            <div className="af-login-preview-note">
              <Alert type="info" showIcon title="Đăng ký tài khoản khách hàng chưa hỗ trợ: backend chưa có API đăng ký. Bạn vẫn đặt hàng được mà không cần tài khoản." />
            </div>
            <p className="af-login-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
          </section>
        </div>
      </main>

      <footer className="af-login-footer"><span>AquaFlow · Hệ thống quản lý cửa hàng nước</span><span>Một cửa hàng. Một không gian quản lý.</span></footer>
    </div>
  )
}
