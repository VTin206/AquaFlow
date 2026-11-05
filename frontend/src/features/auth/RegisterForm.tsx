import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input } from 'antd'
import { Link } from 'react-router'
import { LockKeyhole, Mail, Phone, UserRound, UserRoundPlus } from 'lucide-react'
import { authService } from './authService'
import { focusNextOnEnter } from '@/shared/utils/forms'

type RegisterValues = { fullName: string; phone: string; email: string; password: string; confirm: string; agree: boolean }

/**
 * Form đăng ký tài khoản khách hàng, dùng ở trang /register và khung đăng nhập trên trang khách.
 * Tạo tài khoản CUSTOMER qua API; sau đó khách đăng nhập bằng email và mật khẩu vừa chọn.
 */
export function RegisterForm({ size = 'large' }: { size?: 'middle' | 'large' }) {
  const [form] = Form.useForm<RegisterValues>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [registered, setRegistered] = useState(false)
  const submit = async (values: RegisterValues) => {
    setLoading(true)
    setError(undefined)
    try {
      await authService.register(values)
      form.resetFields()
      setRegistered(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }
  if (registered)
    return (
      <Alert
        type="success"
        showIcon
        title="Tạo tài khoản thành công"
        description="Bạn có thể đăng nhập để đặt hàng và xem đơn của mình."
        action={
          <Link to="/shop/account">
            <Button type="primary">Đăng nhập</Button>
          </Link>
        }
      />
    )
  return (
    <>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form
        form={form}
        name="register"
        layout="vertical"
        requiredMark={false}
        autoComplete="on"
        onKeyDown={focusNextOnEnter}
        onFinish={submit}
        disabled={loading}
      >
        <Form.Item
          label="Họ và tên"
          name="fullName"
          rules={[
            { required: true, whitespace: true, message: 'Nhập họ và tên.' },
            { max: 150, message: 'Tối đa 150 ký tự.' },
          ]}
        >
          <Input size={size} prefix={<UserRound size={17} aria-hidden />} placeholder="Nguyễn Văn An" autoComplete="name" />
        </Form.Item>
        <Form.Item
          label="Số điện thoại"
          name="phone"
          rules={[
            { required: true, message: 'Nhập số điện thoại.' },
            { pattern: /^(?:0\d{9,10}|\+?84\d{9,10})$/, message: 'Số điện thoại không hợp lệ.' },
          ]}
        >
          <Input size={size} prefix={<Phone size={17} aria-hidden />} placeholder="0901 234 567" autoComplete="tel" inputMode="tel" />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
          <Input
            type="email"
            size={size}
            prefix={<Mail size={17} aria-hidden />}
            placeholder="name@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Form.Item>
        {/* Hai ô mật khẩu đứng cạnh nhau ở trang tài khoản trong cửa hàng (xem .af-shop-account-page). */}
        <div className="af-register-passwords">
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { required: true, message: 'Nhập mật khẩu.' },
              { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự.' },
              { max: 128, message: 'Mật khẩu tối đa 128 ký tự.' },
              {
                validator: (_, value) =>
                  !value || new TextEncoder().encode(value).length <= 72
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu tối đa 72 byte UTF-8.')),
              },
            ]}
          >
            <Input.Password
              size={size}
              prefix={<LockKeyhole size={17} aria-hidden />}
              placeholder="Ít nhất 8 ký tự"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label="Nhập lại mật khẩu"
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu.' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu nhập lại không khớp.')),
              }),
            ]}
          >
            <Input.Password
              size={size}
              prefix={<LockKeyhole size={17} aria-hidden />}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
            />
          </Form.Item>
        </div>
        <Form.Item
          name="agree"
          valuePropName="checked"
          rules={[{ validator: (_, value) => (value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với điều khoản.'))) }]}
        >
          <Checkbox>Tôi đồng ý với điều khoản sử dụng của cửa hàng</Checkbox>
        </Form.Item>
        <Button type="primary" size={size} htmlType="submit" block loading={loading} icon={<UserRoundPlus size={18} />}>
          Tạo tài khoản
        </Button>
      </Form>
    </>
  )
}
