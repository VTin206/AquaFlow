import { App, Button } from 'antd'
import { Copy } from 'lucide-react'

/** Nút nhỏ cạnh mã đơn: chép mã để khách gửi cửa hàng hoặc tra cứu lại. */
export function CopyOrderCode({ code }: { code: string }) {
  const { message } = App.useApp()
  return (
    <Button
      type="text"
      size="small"
      icon={<Copy size={15} />}
      aria-label="Sao chép mã đơn"
      title="Sao chép mã đơn"
      onClick={() =>
        navigator.clipboard
          ?.writeText(code)
          .then(() => message.success(`Đã sao chép mã đơn ${code}.`))
          .catch(() => message.info(`Mã đơn của bạn: ${code}`))
      }
    />
  )
}
