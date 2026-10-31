import { useEffect, useState } from 'react'
import { Alert, App, Button, Checkbox, ConfigProvider, Divider, Form, Input, Modal } from 'antd'
import { ArrowLeft, ArrowRight, CircleCheck, Headphones, LockKeyhole, Package, Store, Truck, UserRound, Waves } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { focusNextOnEnter } from '@/shared/utils/forms'
import { useAuth } from './useAuth'
import type { LoginCredentials } from './authService'
import { devAccounts } from './devAccounts'
import './login.css'

const REMEMBERED_EMAIL_KEY = 'aquaflow.auth.remembered-email'
type LoginFormValues = LoginCredentials & { rememberMe?: boolean }

export function LoginPage() {
  const { message } = App.useApp()
  const { login, enterDemo, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ''
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'

  const submitLogin = async ({ email, password, rememberMe }: LoginFormValues) => {
    setSubmitting(true)
    try {
      await login({ email, password })
      if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      message.success('Đăng nhập thành công.')
      navigate(returnTo, { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDemo = () => {
    enterDemo()
    navigate(returnTo, { replace: true })
  }

  useEffect(() => {
    if (isAuthenticated) navigate(returnTo, { replace: true })
  }, [isAuthenticated, navigate, returnTo])

  return (
    <div className="af-login-page">
      <header className="af-login-header">
        <Link to="/shop" className="af-topbar-brand" aria-label="AquaFlow — Về cửa hàng">
          <span className="af-brand-mark"><Waves size={22} strokeWidth={2.2} /></span>
          <strong>AquaFlow</strong>
        </Link>
        <div className="af-login-header-actions">
          <Link to="/shop"><Button type="text" icon={<ArrowLeft size={17} />}>Về cửa hàng</Button></Link>
          <Button type="text" icon={<Headphones size={17} />} onClick={() => setHelpOpen(true)}>Hỗ trợ</Button>
        </div>
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
                initialValues={{ email: rememberedEmail, rememberMe: Boolean(rememberedEmail) }}
                name="login"
                autoComplete="on"
                layout="vertical"
                requiredMark={false}
                onFinish={submitLogin}
                onKeyDown={focusNextOnEnter}
              >
                <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
                  <Input type="email" size="large" prefix={<UserRound size={17} aria-hidden />} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
                </Form.Item>
                <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }, { min: 8, max: 128, message: 'Mật khẩu có từ 8 đến 128 ký tự.' }]}>
                  <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
                </Form.Item>
                <div className="af-login-form-options">
                  <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                    <Checkbox>Ghi nhớ tôi</Checkbox>
                  </Form.Item>
                  <Button type="link" size="small" onClick={() => setHelpOpen(true)}>Quên mật khẩu?</Button>
                </div>
                <Button type="primary" size="large" htmlType="submit" loading={submitting} block icon={<ArrowRight size={18} />} iconPlacement="end">Đăng nhập</Button>
              </Form>
              <p className="af-login-switch">Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link></p>
              {devAccounts.length > 0 && (
                <div className="af-login-dev">
                  <Divider plain><span className="af-login-divider-text">Đăng nhập nhanh (dev)</span></Divider>
                  <div className="af-login-dev-list">
                    {devAccounts.map((account) => (
                      <Button key={account.email} disabled={submitting} title={account.email} onClick={() => submitLogin(account)}>{account.label}</Button>
                    ))}
                  </div>
                </div>
              )}
              <Divider plain><span className="af-login-divider-text">Khám phá AquaFlow</span></Divider>
              <Button block size="large" onClick={openDemo}>Xem bản dùng thử</Button>
            </ConfigProvider>
            <div className="af-login-preview-note">
              <Alert type="info" showIcon title="Tài khoản thật quản lý danh mục, khách hàng và xem đơn hàng. Nhập kho và cập nhật đơn đang được hoàn thiện." />
            </div>
          </section>
        </div>
      </main>

      <footer className="af-login-footer"><span>AquaFlow · Hệ thống quản lý cửa hàng nước</span><span>Một cửa hàng. Một không gian quản lý.</span></footer>
      <Modal title="Hỗ trợ đăng nhập" open={helpOpen} centered onCancel={() => setHelpOpen(false)} footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Đã hiểu</Button>}>
        <p>Nếu bạn chưa có tài khoản hoặc quên mật khẩu, hãy liên hệ người quản trị cửa hàng để được hỗ trợ.</p>
        <Alert type="info" showIcon title="Auth API" description="Đăng nhập gửi email và mật khẩu tới /api/v1/auth/login. Người quản trị cấp tài khoản trên database trước khi sử dụng." />
      </Modal>
    </div>
  )
}
