import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Form, Input, Modal, Select } from 'antd'
import { ModalTotalFooter } from '@/shared/components/ModalTotalFooter'
import { QueryError } from '@/shared/components/QueryError'
import { runEach } from '@/shared/utils/bulk'
import { currency } from '@/shared/utils/format'
import { modalWidth } from '@/shared/utils/modal'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { deliveryApi } from '../deliveryApi'
import { useDeliveryDrivers } from '../useLiveTrips'
import type { WaitingOrder } from './WaitingOrdersCard'

type Failed = { item: WaitingOrder; error: string }
type Values = { driverId?: number; vehicle?: string }

/** Tạo chuyến rồi thêm lần lượt từng đơn; đơn nào lỗi thì báo lại, các đơn khác vẫn ở trên chuyến. */
export function LiveCreateTripModal({
  orders,
  onClose,
  onCreated,
}: {
  orders: WaitingOrder[]
  onClose: () => void
  onCreated: (tripId: number, failed: Failed[]) => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<Values>()
  const drivers = useDeliveryDrivers()
  const jugs = orders.reduce((sum, order) => sum + order.jugs, 0)
  const due = orders.reduce((sum, order) => sum + (order.due ?? 0), 0)
  const create = useMutation({
    mutationFn: async (values: Values) => {
      const trip = await deliveryApi.create({ driverId: values.driverId, vehicle: values.vehicle?.trim() || undefined })
      const result = await runEach(orders, (order) => deliveryApi.add(trip.id, Number(order.id), order.redelivery))
      return { tripId: trip.id, failed: result.failed }
    },
    onSuccess: ({ tripId, failed }) => onCreated(tripId, failed),
    onError: (error: Error) => message.error(error.message),
    onSettled: () => invalidateLiveData(client),
  })

  return (
    <Modal
      open
      title={`Tạo chuyến giao · ${orders.length} đơn`}
      okText="Tạo chuyến"
      cancelText="Hủy"
      width={modalWidth.small}
      footer={(_, { OkBtn, CancelBtn }) => (
        <ModalTotalFooter label="Bình cần giao · tiền cần thu" value={`${jugs} bình · ${currency(due)}`}>
          <CancelBtn />
          <OkBtn />
        </ModalTotalFooter>
      )}
      confirmLoading={create.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        <Form.Item name="driverId" label="Tài xế" extra="Có thể phân sau, nhưng phải có tài xế mới xuất kho được.">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={drivers.isPending}
            placeholder="Chọn tài xế đang hoạt động"
            options={drivers.data?.map((driver) => ({ value: driver.id, label: driver.name }))}
          />
        </Form.Item>
        {drivers.isError && <QueryError error={drivers.error} onRetry={drivers.refetch} />}
        {drivers.isSuccess && !drivers.data.length && <Alert type="info" title="Chưa có tài xế đang hoạt động." style={{ marginBottom: 16 }} />}
        <Form.Item name="vehicle" label="Biển số xe" rules={[{ max: 40 }]}>
          <Input placeholder="Không bắt buộc" />
        </Form.Item>
      </Form>
      <ul className="af-trip-stops">
        {orders.map((order, index) => (
          <li key={order.id}>
            <span className="af-trip-stop-index">{index + 1}</span>
            <div className="af-cell-stack">
              <span>
                {order.code} · {order.customer}
              </span>
              <small>{order.address}</small>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
