import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Popconfirm, Tooltip, type ButtonProps } from 'antd'
import { Check } from 'lucide-react'
import type { Order } from '@/features/orders/types'
import { invalidateLiveData } from './invalidateLiveData'
import { confirmOrderHint, orderApi } from './orderApi'

/** Xác nhận đơn chờ ngay trên danh sách, không cần mở chi tiết; `iconOnly` cho cột thao tác hẹp. */
export function LiveConfirmButton({
  order,
  size = 'small',
  iconOnly = false,
}: {
  order: Pick<Order, 'id' | 'code'>
  size?: ButtonProps['size']
  iconOnly?: boolean
}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const code = order.code ?? order.id
  const confirm = useMutation({
    mutationFn: () => orderApi.updateStatus(Number(order.id), 'CONFIRMED'),
    onSuccess: () => {
      void invalidateLiveData(queryClient)
      message.success(`Đã xác nhận đơn ${code} và giữ hàng trong kho.`)
    },
    // Đơn có thể đã đổi trạng thái ở nơi khác (409): tải lại để hiện trạng thái mới.
    onError: (error: Error) => {
      void invalidateLiveData(queryClient)
      message.error(error.message)
    },
  })
  const button = (
    <Button
      type="primary"
      size={size}
      icon={iconOnly ? <Check size={15} /> : undefined}
      loading={confirm.isPending}
      aria-label={`Xác nhận đơn ${code}`}
    >
      {iconOnly ? undefined : 'Xác nhận'}
    </Button>
  )
  return (
    <Popconfirm
      title={`Xác nhận đơn ${code}?`}
      description={confirmOrderHint}
      okText="Xác nhận"
      cancelText="Chưa"
      onConfirm={() => confirm.mutate()}
    >
      {iconOnly ? <Tooltip title="Xác nhận đơn">{button}</Tooltip> : button}
    </Popconfirm>
  )
}
