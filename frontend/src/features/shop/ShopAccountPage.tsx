import { useEffect, useState } from 'react'
import { Alert, App, Avatar, Button, Divider, Form, Input } from 'antd'
import { ArrowRight, FlaskConical, LayoutDashboard, LockKeyhole, LogOut, PackageSearch, ShoppingBag, UserRound, UserRoundPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { focusNextOnEnter } from '../../shared/utils/forms'
import type { LoginCredentials } from '../auth/authService'
import { devAccounts } from '../auth/devAccounts'
import { RegisterForm } from '../auth/RegisterForm'
import { useAuth } from '../auth/useAuth'
import { useStaff } from '../auth/useStaff'

/**
 * Trang tài khoản trong cửa hàng (bố cục kiểu Uniqlo): đăng nhập bên trái, tạo tài khoản hoặc mua không cần tài khoản bên phải.
 * BE mới có tài khoản nhân viên nên đăng nhập xong vào trang quản lý; tài khoản khách còn chờ API.
 */
export function ShopAccountPage() {
  const { login, logout, enterDemo, isAuthenticated, user } = useAuth()
  const staff = useStaff()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => { document.title = 'Tài khoản | AquaFlow' }, [])

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
          <Avatar size={56} className="af-avatar">{user.name.trim().charAt(0).toUpperCase()}</Avatar>
          <div>
            <strong>{user.name}</strong>
            {user.email && <small>{user.email}</small>}
            <small>{staff ? `${staff.roleName}${staff.isDemo ? ' · dùng thử' : ''}` : user.role}</small>
          </div>
          <div className="af-shop-account-actions">
            <Button type="primary" icon={<LayoutDashboard size={16} />} onClick={() => navigate('/')}>Trang quản lý</Button>
            <Button danger icon={<LogOut size={16} />} onClick={() => logout()}>Đăng xuất</Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Đăng nhập</h1>
      <div className="af-shop-account-grid">
        <section aria-label="Đăng nhập">
          <Alert type="info" showIcon style={{ marginBottom: 20 }} title="Hiện chỉ tài khoản nhân viên đăng nhập được; đăng nhập xong sẽ vào trang quản lý cửa hàng." />
          {error && <Alert type="error" showIcon style={{ marginBottom: 20 }} title={error} />}
          <Form<LoginCredentials> name="shop-login" layout="vertical" requiredMark={false} autoComplete="on" onFinish={submit} onKeyDown={focusNextOnEnter}>
            <Form.Item label="Địa chỉ email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
              <Input type="email" size="large" prefix={<UserRound size={17} aria-hidden />} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </Form.Item>
            <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }, { min: 8, max: 128, message: 'Mật khẩu có từ 8 đến 128 ký tự.' }]} style={{ marginBottom: 8 }}>
              <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
            </Form.Item>
            <Button type="link" className="af-shop-account-forgot" onClick={() => modal.info({ title: 'Quên mật khẩu', content: 'Liên hệ người quản trị cửa hàng để được cấp lại mật khẩu.', okText: 'Đã hiểu' })}>Quên mật khẩu?</Button>
            <Button type="primary" size="large" htmlType="submit" loading={submitting} icon={<ArrowRight size={18} />} iconPlacement="end" className="af-shop-account-submit">Đăng nhập</Button>
          </Form>
          {devAccounts.length > 0 && (
            <>
              <Divider plain><span className="af-shop-account-divider">Đăng nhập nhanh (dev)</span></Divider>
              <div className="af-shop-account-dev">
                {devAccounts.map((account) => (
                  <Button key={account.email} disabled={submitting} title={account.email} onClick={() => submit(account)}>{account.label}</Button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="af-shop-account-side" aria-label="Chưa có tài khoản">
          <Link to="/shop/register"><Button size="large" block icon={<UserRoundPlus size={18} />}>Tạo tài khoản</Button></Link>
          <p>Lưu địa chỉ giao và xem lại đơn đã đặt.</p>
          <Divider plain>hoặc</Divider>
          <ul className="af-shop-account-links">
            <li><Link to="/shop"><ShoppingBag size={16} aria-hidden /> Mua hàng không cần tài khoản</Link></li>
            <li><Link to="/track"><PackageSearch size={16} aria-hidden /> Tra cứu đơn</Link></li>
            <li><Button type="link" icon={<FlaskConical size={16} />} onClick={() => { enterDemo(); navigate('/') }}>Xem bản dùng thử</Button></li>
          </ul>
        </section>
      </div>
    </div>
  )
}

/** Trang đăng ký trong cửa hàng; form dùng chung với /register. */
export function ShopRegisterPage() {
  useEffect(() => { document.title = 'Tạo tài khoản | AquaFlow' }, [])
  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Tạo tài khoản</h1>
      <div className="af-shop-account-grid">
        <section aria-label="Thông tin đăng ký"><RegisterForm /></section>
        <section className="af-shop-account-side" aria-label="Đã có tài khoản">
          <p>Đã có tài khoản?</p>
          <Link to="/shop/account"><Button size="large" block>Đăng nhập</Button></Link>
          <Link to="/shop"><Button size="large" block icon={<ShoppingBag size={18} />}>Mua hàng không cần tài khoản</Button></Link>
        </section>
      </div>
    </div>
  )
}
