import type { ReactNode } from 'react'
import { Button, Space } from 'antd'

/** Thanh thao tác hiện khi đã tích chọn ít nhất một dòng trong bảng. */
export function BulkBar({ count, noun, onClear, children }: { count: number; noun: string; onClear: () => void; children: ReactNode }) {
  if (!count) return null
  return (
    <div className="af-bulk-bar" role="region" aria-label="Thao tác với các dòng đã chọn">
      <span>
        Đã chọn <strong>{count}</strong> {noun}
      </span>
      <Space wrap size={8}>
        {children}
        <Button type="text" onClick={onClear}>
          Bỏ chọn
        </Button>
      </Space>
    </div>
  )
}
