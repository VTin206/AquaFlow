import { Alert, QRCode } from 'antd'
import type { StoreSettings } from '@/features/settings/types'
import { currency } from '../utils/format'
import { bankBinOf, transferNote, vietQrPayload } from './vietqr'

type TransferQrProps = {
  settings?: StoreSettings
  amount: number
  /** Nội dung chuyển khoản, thường là mã đơn. */
  note: string
  size?: number
  /** Bản in: không viền, không cảnh báo. */
  compact?: boolean
}

/** Mã VietQR kèm thông tin tài khoản nhận để khách quét bằng ứng dụng ngân hàng. */
export function TransferQr({ settings, amount, note, size = 168, compact }: TransferQrProps) {
  const bin = bankBinOf(settings?.bankName)
  if (!settings?.bankAccount || !bin) {
    return compact ? null : (
      <Alert type="info" showIcon title="Chưa tạo được mã QR" description="Chọn ngân hàng hỗ trợ VietQR và nhập số tài khoản trong Cài đặt cửa hàng." />
    )
  }
  const content = transferNote(note)
  return (
    <div className={`af-transfer-qr${compact ? ' is-compact' : ''}`}>
      <QRCode
        type="svg"
        value={vietQrPayload({ bin, account: settings.bankAccount, amount, note: content })}
        size={size}
        bordered={!compact}
        errorLevel="M"
        bgColor="#ffffff"
        color="#000000"
      />
      <dl>
        <dt>Ngân hàng</dt>
        <dd>{settings.bankName}</dd>
        <dt>Số tài khoản</dt>
        <dd>{settings.bankAccount}</dd>
        {settings.bankHolder && (
          <>
            <dt>Chủ tài khoản</dt>
            <dd>{settings.bankHolder}</dd>
          </>
        )}
        <dt>Số tiền</dt>
        <dd>
          <strong>{currency(amount)}</strong>
        </dd>
        <dt>Nội dung</dt>
        <dd>
          <strong>{content}</strong>
        </dd>
      </dl>
    </div>
  )
}
