import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Form, Input, Result } from 'antd'
import { Link, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { passwordResetApi } from './passwordResetApi'

export function ForgotPasswordPage() {
  const lock = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState<string>()
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const submit = async ({ email }: { email: string }) => {
    if (lock.current || cooldown) return
    lock.current = true
    setPending(true); setError(undefined); setSent(undefined)
    try {
      const response = await passwordResetApi.request(email)
      setSent(response.message)
      setCooldown(60)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể gửi yêu cầu. Vui lòng thử lại.')
    } finally { lock.current = false; setPending(false) }
  }
  return <div className="af-shop-page af-shop-narrow">
    <Card title={<h1>Quên mật khẩu</h1>}>
      <p>Nhập email đã đăng ký tài khoản AquaFlow. Liên kết khôi phục sẽ được gửi đến email đó và có hiệu lực 15 phút.</p>
      {sent && <Alert type="success" showIcon title="Đã tiếp nhận yêu cầu" description={sent} style={{ marginBottom: 16 }} />}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={submit} disabled={pending}>
        <Form.Item name="email" label="Email đã đăng ký" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }, { max: 150 }]}>
          <Input type="email" autoComplete="email" autoCapitalize="none" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={pending} disabled={pending || cooldown > 0}>
          {cooldown ? `Gửi lại sau ${cooldown}s` : 'Gửi liên kết khôi phục'}
        </Button>
      </Form>
      <p><Link to="/login">Quay lại đăng nhập</Link></p>
    </Card>
  </div>
}

export function ResetPasswordPage() {
  const location = useLocation()
  const { logout } = useAuth()
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)
  const lock = useRef(false)
  const [form] = Form.useForm()
  useEffect(() => {
    // Fragment is never sent to the server. Remove it from the current history entry after reading.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }, [])
  const submit = async ({ password }: { password: string }) => {
    if (lock.current) return
    lock.current = true; setPending(true); setError(undefined)
    try {
      await passwordResetApi.reset(token, password)
      form.resetFields()
      logout()
      setDone(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.') }
    finally { lock.current = false; setPending(false) }
  }
  return <div className="af-shop-page af-shop-narrow">
    <Card title={<h1>Đặt lại mật khẩu</h1>}>
      {done ? <Result status="success" title="Đã đặt mật khẩu mới" subTitle="Các phiên đăng nhập cũ đã kết thúc. Hãy đăng nhập bằng mật khẩu mới." extra={<Link to="/login"><Button type="primary">Đăng nhập</Button></Link>} /> : !/^[A-Za-z0-9_-]{43}$/.test(token) ? (
        <Alert type="warning" showIcon title="Liên kết khôi phục không hợp lệ" description={<Link to="/forgot-password">Yêu cầu liên kết mới</Link>} />
      ) : <>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={submit} disabled={pending}>
          <Form.Item name="password" label="Mật khẩu mới" rules={[
            { required: true, whitespace: true, message: 'Nhập mật khẩu mới.' },
            { min: 8, max: 128, message: 'Mật khẩu từ 8 đến 128 ký tự.' },
            { validator: (_, value?: string) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error('Mật khẩu tối đa 72 byte UTF-8.')) },
          ]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item name="confirm" label="Nhập lại mật khẩu mới" dependencies={['password']} rules={[
            { required: true, message: 'Nhập lại mật khẩu mới.' },
            ({ getFieldValue }) => ({ validator: (_, value) => !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Hai mật khẩu chưa khớp.')) }),
          ]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={pending} disabled={pending}>Lưu mật khẩu mới</Button>
        </Form>
        <p><Link to="/forgot-password">Yêu cầu liên kết mới</Link></p>
      </>}
    </Card>
  </div>
}
