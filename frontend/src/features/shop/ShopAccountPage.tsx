import { useEffect, useState } from 'react'
import { Alert, App, Avatar, Button, Divider, Form, Input } from 'antd'
import {
  ArrowRight,
  FlaskConical,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PackageSearch,
  ShoppingBag,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { backendFeatures } from '@/shared/features'
import { focusNextOnEnter } from '@/shared/utils/forms'
import type { LoginCredentials } from '@/features/auth/authService'
import { devAccounts } from '@/features/auth/devAccounts'
import { RegisterForm } from '@/features/auth/RegisterForm'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { accountDestination, isCustomer } from '@/features/auth/accountAccess'
import { CustomerAccountPanel } from './CustomerAccountPanel'

/**
 * Trang tài khoản trong cửa hàng (bố cục kiểu Uniqlo): đăng nhập bên trái, tạo tài khoản hoặc mua không cần tài khoản bên phải.
 * Dùng cùng API đăng nhập; khách vào đơn của mình, nhân viên vào không gian quản lý.
 */
export function ShopAccountPage() {
  const { login, logout, enterDemo, isAuthenticated, user } = useAuth()
  const staff = useStaff()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    document.title = 'Tài khoản | AquaFlow'
  }, [])

  const submit = async (values: LoginCredentials) => {
    setSubmitting(true)
    setError(undefined)
    try {
      await login(values)
      message.success('Đăng nhập thành công.')
      navigate('/')
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
            <small>{staff ? `${staff.roleName}${staff.isDemo ? ' · dùng thử' : ''}` : user.role}</small>
          </div>
          <div className="af-shop-account-actions">
            <Button type="primary" icon={<LayoutDashboard size={16} />} onClick={() => navigate(accountDestination(user))}>
              {isCustomer(user) ? 'Đơn hàng của tôi' : 'Trang quản lý'}
            </Button>
            <Button danger icon={<LogOut size={16} />} onClick={() => logout()}>
              Đăng xuất
            </Button>
          </div>
        </section>
        {isCustomer(user) && !user.isDemo && <CustomerAccountPanel />}
      </div>
    )
  }

  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Đăng nhập</h1>
      <div className="af-shop-account-grid">
        <section aria-label="Đăng nhập">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
            title="Khách hàng đăng nhập để xem đơn của mình. Nhân viên đăng nhập để vào trang quản lý."
          />
          {error && <Alert type="error" showIcon style={{ marginBottom: 20 }} title={error} />}
          <Form<LoginCredentials>
            name="shop-login"
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
            <Link to="/forgot-password" className="af-shop-account-forgot">
              Quên mật khẩu?
            </Link>
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
          {backendFeatures.customerAccounts && (
            <>
              <Link to="/shop/register">
                <Button size="large" block icon={<UserRoundPlus size={18} />}>
                  Tạo tài khoản
                </Button>
              </Link>
              <p>Lưu địa chỉ giao và xem lại đơn đã đặt.</p>
              <Divider plain>hoặc</Divider>
            </>
          )}
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
              <Button
                type="link"
                icon={<FlaskConical size={16} />}
                onClick={() => {
                  enterDemo()
                  navigate('/')
                }}
              >
                Xem bản dùng thử
              </Button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

/** Trang đăng ký trong cửa hàng; form dùng chung với /register. */
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
