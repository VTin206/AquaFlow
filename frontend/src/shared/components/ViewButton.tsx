import { Button, Tooltip } from 'antd'
import type { ButtonProps } from 'antd'
import { Eye } from 'lucide-react'

type Props = {
  /** Chữ trong gợi ý khi rê chuột, ví dụ "Xem chi tiết", "Xem hồ sơ". */
  title?: string
  /** Đối tượng đang xem, để trình đọc màn hình đọc rõ: "Xem chi tiết đơn DH-12". */
  subject?: string
  size?: ButtonProps['size']
  onClick?: ButtonProps['onClick']
}

/** Nút xem chung cho mọi bảng và thẻ: chỉ biểu tượng mắt, chữ nằm trong gợi ý và nhãn đọc màn hình. */
export function ViewButton({ title = 'Xem chi tiết', subject, size = 'small', onClick }: Props) {
  return (
    <Tooltip title={title}>
      <Button
        size={size}
        icon={<Eye size={size === 'small' ? 15 : 16} />}
        aria-label={subject ? `${title} ${subject}` : title}
        onClick={onClick}
      />
    </Tooltip>
  )
}
