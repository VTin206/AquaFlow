import { useState } from 'react'
import { Alert, App, Button, Form, Input, Modal, Tabs } from 'antd'
import { ArrowRight, LockKeyhole, UserRound, Waves } from 'lucide-react'
import { useNavigate } from 'react-router'
import { RegisterForm } from '../../auth/RegisterForm'
import { focusNextOnEnter } from '../../../shared/utils/forms'
import { useAuth } from '../../auth/useAuth'
import type { LoginCredentials } from '../../auth/authService'

export type AuthTab = 'login' | 'register'

/**
 * Đăng nhập, tạo tài khoản ngay trên trang khách, không rời cửa hàng.
 * BE mới có tài khoản nhân viên nên đăng nhập xong đưa vào trang quản lý; đăng ký còn chờ API.
 */
export function AuthModal({ tab, onTabChange, onClose }: { tab: AuthTab | null; onTabChange: (tab: AuthTab) => void; onClose: () => void }) {
  const { login } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  const submit = async (values: LoginCredentials) => {
    setSubmitting(true)
    setError(undefined)
    try {
      await login(values)
      message.success('Đăng nhập thành công.')
      onClose()
      navigate('/')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={tab !== null} onCancel={onClose} footer={null} width={460} destroyOnHidden centered className="af-auth-modal">
      <div className="af-auth-modal-brand">
        <span className="af-brand-mark"><Waves size={20} strokeWidth={2.2} /></span>
        <strong>AquaFlow</strong>
      </div>
      <Tabs
        activeKey={tab ?? 'login'}
        onChange={(key) => { setError(undefined); onTabChange(key as AuthTab) }}
        centered
        items={[
          {
            key: 'login',
            label: 'Đăng nhập',
            children: (
              <>
                <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Hiện chỉ tài khoản nhân viên đăng nhập được; đăng nhập xong sẽ vào trang quản lý." />
                {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={error} />}
                <Form<LoginCredentials> name="shop-login" layout="vertical" requiredMark={false} autoComplete="on" onFinish={submit} onKeyDown={focusNextOnEnter}>
                  <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', whitespace: true, message: 'Nhập email hợp lệ.' }]}>
                    <Input type="email" size="large" prefix={<UserRound size={17} aria-hidden />} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
                  </Form.Item>
                  <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }, { min: 8, max: 128, message: 'Mật khẩu có từ 8 đến 128 ký tự.' }]}>
                    <Input.Password size="large" prefix={<LockKeyhole size={17} aria-hidden />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
                  </Form.Item>
                  <Button type="primary" size="large" htmlType="submit" block loading={submitting} icon={<ArrowRight size={18} />} iconPlacement="end">Đăng nhập</Button>
                </Form>
                <p className="af-auth-modal-switch">Chưa có tài khoản? <Button type="link" size="small" onClick={() => onTabChange('register')}>Tạo tài khoản</Button></p>
              </>
            ),
          },
          {
            key: 'register',
            label: 'Tạo tài khoản',
            children: (
              <>
                <RegisterForm size="middle" />
                <p className="af-auth-modal-switch">Đã có tài khoản? <Button type="link" size="small" onClick={() => onTabChange('login')}>Đăng nhập</Button></p>
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}
