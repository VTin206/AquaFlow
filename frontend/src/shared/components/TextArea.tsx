import { Input, type GetProps } from 'antd'

type TextAreaProps = GetProps<typeof Input.TextArea>

/**
 * Ô nhập nhiều dòng dùng chung (địa chỉ, ghi chú, lý do): tự giãn theo nội dung từ `rows` dòng (mặc định 2)
 * tới 5 dòng rồi cuộn bên trong. Tay kéo góc tắt chung ở ConfigProvider (providers.tsx).
 * `maxLength` chặn ngay khi gõ (rule `max` của Form chỉ báo lỗi lúc lưu); truyền đúng giới hạn của trường,
 * ô chưa có giới hạn từ backend dùng tạm 500 ký tự.
 */
export function TextArea({ rows = 2, maxLength = 500, ...props }: TextAreaProps) {
  return <Input.TextArea autoSize={{ minRows: rows, maxRows: Math.max(rows, 5) }} maxLength={maxLength} {...props} />
}
