import { App, Form, Input, Modal, Select } from 'antd'
import { currency } from '@/shared/utils/format'
import { amountDue, jugCount, type Order } from '@/features/orders/types'
import { drivers, type TripDraft } from '../types'
import { useTripAction } from '../useTrips'

type CreateTripModalProps = { orders: Order[]; open: boolean; onClose: () => void; onCreated: (tripId: string) => void }

export function CreateTripModal({ orders, open, onClose, onCreated }: CreateTripModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Omit<TripDraft, 'orderIds'>>()
  const action = useTripAction()
  const jugs = orders.reduce((sum, order) => sum + jugCount(order), 0)
  const due = orders.reduce((sum, order) => sum + amountDue(order), 0)

  return (
    <Modal
      open={open}
      title={`Tạo chuyến giao · ${orders.length} đơn`}
      okText="Tạo chuyến"
      cancelText="Hủy"
      confirmLoading={action.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ driver: drivers[0] }}
        onFinish={(values) =>
          action.mutate(
            { kind: 'create', draft: { ...values, orderIds: orders.map((order) => order.id) } },
            {
              onSuccess: (trip) => {
                message.success(`Đã tạo chuyến ${trip?.id}.`)
                onClose()
                if (trip) onCreated(trip.id)
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
      >
        <Form.Item name="driver" label="Tài xế" rules={[{ required: true, message: 'Chọn tài xế.' }]}>
          <Select options={drivers.map((driver) => ({ value: driver, label: driver }))} />
        </Form.Item>
        <Form.Item name="vehicle" label="Biển số xe" rules={[{ max: 20 }]}>
          <Input placeholder="Không bắt buộc" />
        </Form.Item>
      </Form>
      <ul className="af-trip-stops">
        {orders.map((order, index) => (
          <li key={order.id}>
            <span className="af-trip-stop-index">{index + 1}</span>
            <div className="af-cell-stack">
              <span>
                {order.id} · {order.customer}
              </span>
              <small>{order.address}</small>
            </div>
          </li>
        ))}
      </ul>
      <div className="af-order-summary">
        <span>Bình cần giao · tiền cần thu</span>
        <strong>
          {jugs} bình · {currency(due)}
        </strong>
      </div>
    </Modal>
  )
}
