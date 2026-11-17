import { useEffect, useState } from 'react'
import { Alert, App, Avatar, Button, Checkbox, Divider, Form, Input, Modal } from 'antd'
import { ArrowRight, Headphones, LayoutDashboard, LockKeyhole, PackageSearch, ShoppingBag, UserRound, UserRoundPlus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { focusNextOnEnter } from '@/shared/utils/forms'
import type { LoginCredentials } from '@/features/auth/authService'
import { devAccounts } from '@/features/auth/devAccounts'
import { RegisterForm } from '@/features/auth/RegisterForm'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { accountDestination, isCustomer } from '@/features/auth/accountAccess'
import { CustomerAccountPanel } from './CustomerAccountPanel'

const REMEMBERED_EMAIL_KEY = 'aquaflow.auth.remembered-email'
type LoginFormValues = LoginCredentials & { rememberMe?: boolean }

/**
 * Trang đăng nhập duy nhất của hệ thống, kiêm trang tài khoản khi đã đăng nhập (bố cục kiểu Uniqlo).
 * Khách vào đơn của mình, nhân viên vào không gian quản lý; bị chặn ở trang nào thì đăng nhập xong quay lại trang đó.
 */
export function ShopAccountPage() {
  const { login, isAuthenticated, user } = useAuth()
  const staff = useStaff()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ''
  const routeState = location.state as { from?: string; email?: string } | null
  const returnTo = routeState?.from ?? '/'
  // Vừa tạo tài khoản xong thì điền sẵn email đó thay cho email đã ghi nhớ.
  const initialEmail = routeState?.email || rememberedEmail

  useEffect(() => {
    document.title = 'Tài khoản | AquaFlow'
  }, [])

  useEffect(() => {
    if (!redirectAfterLogin || !isAuthenticated || !user) return
    navigate(accountDestination(user, returnTo), { replace: true })
  }, [redirectAfterLogin, isAuthenticated, user, navigate, returnTo])

  const submit = async ({ email, password, rememberMe }: LoginFormValues) => {
    setSubmitting(true)
    setError(undefined)
    try {
      await login({ email, password })
      if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      message.success('Đăng nhập thành công.')
      setRedirectAfterLogin(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isAuthenticated && user) {
    return (
      <div className="af-shop-page af-shop-account-page">
        <h1>Tài khoản</h1>
        <section className="af-shop-account-card">
          <Avatar size={56} className="af-avatar">
            {user.name.trim().charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <strong>{user.name}</strong>
            {user.email && <small>{user.email}</small>}
            <small>{staff?.roleName ?? user.role}</small>
          </div>
          {/* Đăng xuất và đơn hàng đã có trong menu tài khoản ở đầu trang; nhân viên không có hồ sơ ở đây nên giữ lối về trang quản lý. */}
          {!isCustomer(user) && (
            <div className="af-shop-account-actions">
              <Button type="primary" icon={<LayoutDashboard size={16} />} onClick={() => navigate(accountDestination(user))}>
                Trang quản lý
              </Button>
            </div>
          )}
        </section>
        {isCustomer(user) && <CustomerAccountPanel />}
      </div>
    )
  }

  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Đăng nhập</h1>
      <div className="af-shop-account-grid">
        <section aria-label="Đăng nhập">
          {error && <Alert type="error" showIcon style={{ marginBottom: 20 }} title={error} />}
          <Form<LoginFormValues>
            name="shop-login"
            initialValues={{ email: initialEmail, rememberMe: Boolean(rememberedEmail) }}
            layout="vertical"
            requiredMark={false}
            autoComplete="on"
            onFinish={submit}
            onKeyDown={focusNextOnEnter}
          >
            <Form.Item
              label="Địa chỉ email"
              name="email"
              rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}
            >
              <Input
                type="email"
                size="large"
                prefix={<UserRound size={17} aria-hidden />}
                placeholder="name@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu.' },
                { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự.' },
                { max: 128, message: 'Mật khẩu tối đa 128 ký tự.' },
              ]}
              style={{ marginBottom: 8 }}
            >
              <Input.Password
                size="large"
                prefix={<LockKeyhole size={17} aria-hidden />}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
              />
            </Form.Item>
            <div className="af-shop-account-options">
              <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                <Checkbox>Ghi nhớ tôi</Checkbox>
              </Form.Item>
              <Link to="/forgot-password">Quên mật khẩu?</Link>
            </div>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={submitting}
              icon={<ArrowRight size={18} />}
              iconPlacement="end"
              className="af-shop-account-submit"
            >
              Đăng nhập
            </Button>
          </Form>
          <Divider plain>hoặc</Divider>
          {/* Backend chưa có OAuth Google: nút vẫn hiện, bấm thì báo chưa hỗ trợ. */}
          <Button
            size="large"
            block
            className="af-shop-account-google"
            icon={<GoogleMark />}
            onClick={() => message.info('Đăng nhập bằng Google chưa hỗ trợ.')}
          >
            Đăng nhập bằng Google
          </Button>
          {devAccounts.length > 0 && (
            <>
              <Divider plain>
                <span className="af-shop-account-divider">Đăng nhập nhanh (dev)</span>
              </Divider>
              <div className="af-shop-account-dev">
                {devAccounts.map((account) => (
                  <Button key={account.email} disabled={submitting} title={account.email} onClick={() => submit(account)}>
                    {account.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="af-shop-account-side" aria-label="Chưa có tài khoản">
          <Link to="/shop/register">
            <Button size="large" block icon={<UserRoundPlus size={18} />}>
              Tạo tài khoản
            </Button>
          </Link>
          <p>Lưu địa chỉ giao và xem lại đơn đã đặt.</p>
          <Divider plain>hoặc</Divider>
          <ul className="af-shop-account-links">
            <li>
              <Link to="/shop">
                <ShoppingBag size={16} aria-hidden /> Mua hàng không cần tài khoản
              </Link>
            </li>
            <li>
              <Link to="/track">
                <PackageSearch size={16} aria-hidden /> Tra cứu đơn
              </Link>
            </li>
            <li>
              <Button type="link" icon={<Headphones size={16} />} onClick={() => setHelpOpen(true)}>
                Hỗ trợ đăng nhập
              </Button>
            </li>
          </ul>
        </section>
      </div>
      <Modal
        title="Hỗ trợ đăng nhập"
        open={helpOpen}
        centered
        onCancel={() => setHelpOpen(false)}
        footer={
          <Button type="primary" onClick={() => setHelpOpen(false)}>
            Đã hiểu
          </Button>
        }
      >
        <p>Nếu bạn quên mật khẩu, hãy chọn "Quên mật khẩu?" hoặc liên hệ cửa hàng để được hỗ trợ.</p>
      </Modal>
    </div>
  )
}

/** Trang đăng ký duy nhất của hệ thống. */
export function ShopRegisterPage() {
  useEffect(() => {
    document.title = 'Tạo tài khoản | AquaFlow'
  }, [])
  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Tạo tài khoản</h1>
      <div className="af-shop-account-grid">
        <section aria-label="Thông tin đăng ký">
          <RegisterForm />
        </section>
        <section className="af-shop-account-side" aria-label="Đã có tài khoản">
          <p>Đã có tài khoản?</p>
          <Link to="/shop/account">
            <Button size="large" block>
              Đăng nhập
            </Button>
          </Link>
          <Link to="/shop">
            <Button size="large" block icon={<ShoppingBag size={18} />}>
              Mua hàng không cần tài khoản
            </Button>
          </Link>
        </section>
      </div>
    </div>
  )
}

/** Chữ G nhiều màu theo hướng dẫn nút "Sign in with Google". */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
