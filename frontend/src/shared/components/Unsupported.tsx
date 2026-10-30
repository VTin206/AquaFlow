import { Tooltip } from 'antd'

/** Gợi ý dưới ô nhập bị khóa vì BE chưa có field tương ứng. */
export const UNSUPPORTED_HINT = 'Chưa hỗ trợ — chờ backend bổ sung.'

/** Giữ chỗ cho dữ liệu BE chưa hỗ trợ; không hiện số giả để tránh hiểu nhầm là dữ liệu thật. */
export function Unsupported({ label = 'Chưa hỗ trợ' }: { label?: string }) {
  return (
    <Tooltip title="Backend chưa hỗ trợ tính năng này">
      <span className="af-text-muted">{label}</span>
    </Tooltip>
  )
}
