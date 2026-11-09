import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Form, Input, Modal, Select } from 'antd'
import { ModalTotalFooter } from '@/shared/components/ModalTotalFooter'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { modalWidth } from '@/shared/utils/modal'
import { useTripBackend, type CreateResult } from '../tripBackend'
import type { WaitingOrder } from './WaitingOrdersCard'

type Values = { driverId?: number; vehicle?: string }

/** Tạo chuyến rồi thêm lần lượt từng đơn; đơn nào lỗi thì báo lại, các đơn khác vẫn ở trên chuyến. */
export function CreateTripModal({
  orders,
  onClose,
  onCreated,
}: {
  orders: WaitingOrder[]
  onClose: () => void
  onCreated: (tripId: number, failed: CreateResult['failed']) => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const backend = useTripBackend()
  const [form] = Form.useForm<Values>()
  const drivers = backend.useDrivers()
  const jugs = orders.reduce((sum, order) => sum + order.jugs, 0)
  const due = orders.reduce((sum, order) => sum + (order.due ?? 0), 0)
  const create = useMutation({
    mutationFn: (values: Values) => backend.ops.create(values, orders),
    onSuccess: ({ tripId, failed }) => onCreated(tripId, failed),
    onError: (error: Error) => message.error(error.message),
    onSettled: () => backend.ops.refresh(client),
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
        <Form.Item
          name="driverId"
          label="Tài xế"
          extra="Có thể phân sau, nhưng phải có tài xế mới xuất kho được."
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={drivers.isPending}
            placeholder="Chọn tài xế đang hoạt động"
            options={drivers.data?.map((driver) => ({ value: driver.id, label: driver.name }))}
          />
        </Form.Item>
        {drivers.isError && drivers.error && <QueryError error={drivers.error} onRetry={drivers.refetch} />}
        {drivers.data && !drivers.data.length && <Alert type="info" title="Chưa có tài xế đang hoạt động." style={{ marginBottom: 16 }} />}
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
