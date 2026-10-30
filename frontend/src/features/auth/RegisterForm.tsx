import { Alert, Button, Checkbox, Form, Input, Tooltip } from 'antd'
import { LockKeyhole, Mail, Phone, UserRound, UserRoundPlus } from 'lucide-react'
import { UNSUPPORTED_HINT } from '../../shared/components/Unsupported'
import { focusNextOnEnter } from '../../shared/utils/forms'

type RegisterValues = { fullName: string; phone: string; email: string; password: string; confirm: string; agree: boolean }

/**
 * Form đăng ký tài khoản khách hàng, dùng ở trang /register và khung đăng nhập trên trang khách.
 * BE chưa có API đăng ký (AuthController chỉ có login, me) nên nút gửi bị khóa "Chưa hỗ trợ". Khi có API thì nối vào `onFinish`.
 */
export function RegisterForm({ size = 'large' }: { size?: 'middle' | 'large' }) {
  const [form] = Form.useForm<RegisterValues>()
  return (
    <>
      <Form form={form} name="register" layout="vertical" requiredMark={false} autoComplete="on" onKeyDown={focusNextOnEnter}>
        <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 150, message: 'Tối đa 150 ký tự.' }]}>
          <Input size={size} prefix={<UserRound size={17} aria-hidden />} placeholder="Nguyễn Văn An" autoComplete="name" />
        </Form.Item>
        <Form.Item label="Số điện thoại" name="phone" rules={[{ required: true, message: 'Nhập số điện thoại.' }, { pattern: /^(?:0\d{9,10}|\+?84\d{9,10})$/, message: 'Số điện thoại không hợp lệ.' }]}>
          <Input size={size} prefix={<Phone size={17} aria-hidden />} placeholder="0901 234 567" autoComplete="tel" inputMode="tel" />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
          <Input type="email" size={size} prefix={<Mail size={17} aria-hidden />} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
        </Form.Item>
        {/* Hai ô mật khẩu đứng cạnh nhau ở trang tài khoản trong cửa hàng (xem .af-shop-account-page). */}
        <div className="af-register-passwords">
          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu.' }, { min: 8, max: 128, message: 'Mật khẩu có từ 8 đến 128 ký tự.' }]}>
            <Input.Password size={size} prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Ít nhất 8 ký tự" autoComplete="new-password" />
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
            <Input.Password size={size} prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
          </Form.Item>
        </div>
        <Form.Item name="agree" valuePropName="checked" rules={[{ validator: (_, value) => (value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với điều khoản.'))) }]}>
          <Checkbox>Tôi đồng ý với điều khoản sử dụng của cửa hàng</Checkbox>
        </Form.Item>
        <Tooltip title={UNSUPPORTED_HINT}>
          {/* span giữ tooltip khi nút bị khóa */}
          <span style={{ display: 'block' }}>
            <Button type="primary" size={size} htmlType="submit" block disabled icon={<UserRoundPlus size={18} />}>Tạo tài khoản (chưa hỗ trợ)</Button>
          </span>
        </Tooltip>
      </Form>
      <div style={{ marginTop: 16 }}>
        <Alert type="info" showIcon title="Đăng ký tài khoản khách hàng chưa hỗ trợ: backend chưa có API đăng ký. Bạn vẫn đặt hàng được mà không cần tài khoản." />
      </div>
    </>
  )
}
