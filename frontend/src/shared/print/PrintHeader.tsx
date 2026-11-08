import type { StoreSettings } from '@/features/settings/types'

/** Đầu chứng từ: thông tin cửa hàng lấy từ trang Cài đặt. */
export function PrintHeader({ settings, title, code, date }: { settings?: StoreSettings; title: string; code: string; date: string }) {
  return (
    <header className="af-doc-header">
      <div className="af-doc-store">
        <strong>{settings?.storeName}</strong>
        <span>{settings?.address}</span>
        <span>
          ĐT: {settings?.phone}
          {settings?.taxCode ? ` · MST: ${settings.taxCode}` : ''}
        </span>
      </div>
      <div className="af-doc-title">
        <h1>{title}</h1>
        <span>
          Số: <strong>{code}</strong> · {date}
        </span>
      </div>
    </header>
  )
}
