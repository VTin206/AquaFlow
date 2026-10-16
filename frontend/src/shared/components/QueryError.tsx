import { Button, Result } from 'antd'
import { RotateCw } from 'lucide-react'

/** Hiển thị khi tải dữ liệu thất bại, kèm nút thử lại. */
export function QueryError({ error, onRetry }: { error: Error; onRetry: () => unknown }) {
  return (
    <Result
      status="error"
      title="Không tải được dữ liệu"
      subTitle={error.message}
      extra={
        <Button icon={<RotateCw size={15} />} onClick={() => onRetry()}>
          Thử lại
        </Button>
      }
    />
  )
}
