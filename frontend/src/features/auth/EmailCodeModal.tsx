import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, Typography, type GetRef } from 'antd'

type EmailCodeModalProps = {
  email?: string
  /** Thời điểm (ms) gửi mã gần nhất và thời điểm được phép bấm "Gửi lại mã". */
  sentAt: number
  resendAt: number
  verifying: boolean
  resending: boolean
  error?: string
  onVerify: (code: string) => void
  onResend: () => void
  onCancel: () => void
}

/** Cửa sổ nhập mã 6 số gửi tới email khi tạo tài khoản. Nhập đủ 6 số là tự xác nhận. */
export function EmailCodeModal({
  email,
  sentAt,
  resendAt,
  verifying,
  resending,
  error,
  onVerify,
  onResend,
  onCancel,
}: EmailCodeModalProps) {
  const [code, setCode] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const open = Boolean(email)
  // `now` chỉ cập nhật mỗi giây, có thể cũ hơn lúc gửi mã: không tính lùi trước thời điểm gửi.
  const wait = Math.max(0, Math.ceil((resendAt - Math.max(now, sentAt)) / 1000))

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [open])

  // Xóa mã đang nhập khi có mã mới, mở lại cửa sổ, hoặc vừa nhập sai. Nếu không xóa, 6 ô vẫn đầy số cũ và
  // gõ số đầu của mã mới sẽ gửi ngay một mã lẫn số cũ. Đặt lại ngay khi render, không qua effect.
  const sentFor = `${email}|${resendAt}`
  const [seen, setSeen] = useState({ sentFor, error })
  if (seen.sentFor !== sentFor || seen.error !== error) {
    setSeen({ sentFor, error })
    // Lỗi chỉ vừa được xóa (đang xác nhận lại) thì giữ nguyên mã.
    if (seen.sentFor !== sentFor || error) setCode('')
  }
  const otp = useRef<GetRef<typeof Input.OTP>>(null)
  // Nhập sai thì đưa con trỏ về ô đầu để gõ lại ngay.
  useEffect(() => {
    if (!error) return
    // Đợi ô nhập hết bị khóa (đang xác nhận) rồi mới đưa con trỏ về.
    const frame = window.requestAnimationFrame(() => otp.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  return (
    <Modal
      open={open}
      centered
      width={420}
      title="Xác nhận email"
      // Bấm ra ngoài không đóng, để khách không mất cửa sổ khi đang chờ mail.
      mask={{ closable: false, blur: true }}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <>
          <Button onClick={onResend} loading={resending} disabled={wait > 0 || verifying}>
            {wait > 0 ? `Gửi lại mã (${wait}s)` : 'Gửi lại mã'}
          </Button>
          <Button type="primary" loading={verifying} disabled={code.length < 6} onClick={() => onVerify(code)}>
            Xác nhận
          </Button>
        </>
      }
    >
      <Typography.Paragraph>
        Nhập mã 6 số đã gửi tới <Typography.Text strong>{email}</Typography.Text>. Mã có hiệu lực 10 phút, không thấy thì xem thư rác.
      </Typography.Paragraph>
      <Input.OTP
        ref={otp}
        aria-label="Mã xác nhận"
        size="large"
        autoFocus
        value={code}
        disabled={verifying}
        status={error ? 'error' : undefined}
        formatter={(value) => value.replace(/\D/g, '')}
        onInput={(cells) => setCode(cells.join(''))}
        onChange={(value) => {
          setCode(value)
          if (/^\d{6}$/.test(value)) onVerify(value)
        }}
      />
      {error && <Alert type="error" showIcon title={error} style={{ marginTop: 16 }} />}
    </Modal>
  )
}
