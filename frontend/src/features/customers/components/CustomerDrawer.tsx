import { useState } from 'react'
import { App, Avatar, Button, Descriptions, Dropdown, Empty, Modal, Table, Tabs, Tag } from 'antd'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'
import { Ellipsis, Pencil, Phone, ShoppingBag } from 'lucide-react'
import { MapLink } from '@/shared/address/MapLink'
import { Money } from '@/shared/components/Money'
import { useFeature } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { currency } from '@/shared/utils/format'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { OrderStatusTag } from '@/features/orders/components/OrderStatusTag'
import { useCustomerOrders } from '@/features/orders/orderData'
import { amountDue, paymentLabel, type Order } from '@/features/orders/types'
import { useIntakeAddresses } from '@/features/orders/useOrderIntake'
import { LiveCustomerAddresses } from '@/features/live/LiveCustomerAddresses'
import { customerCode, type Customer } from '../types'
import { useCustomer, useDeactivateCustomer } from '../useCustomers'
import { LiveBottleLedger } from '../LiveBottleLedger'

type CustomerDrawerProps = {
  customerId: string
  onClose: () => void
  onEdit: (customer: Customer) => void
  onCreateOrder: (customer: Customer) => void
}

/** Hồ sơ khách: liên hệ, đơn hàng, công nợ và sổ vỏ/cọc trong một ngăn kéo. */
export function CustomerDrawer({ customerId, onClose, onEdit, onCreateOrder }: CustomerDrawerProps) {
  const { message, modal } = App.useApp()
  const showPayments = useFeature('orderPayments')
  const showType = useFeature('customerType')
  const showExtras = useFeature('customerProfileExtras')
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')
  const { data: customer } = useCustomer(customerId)
  const { data: customerOrders = [], isPending: loadingOrders } = useCustomerOrders(customerId)
  const deactivate = useDeactivateCustomer()
  const [managingAddresses, setManagingAddresses] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const { addresses, isError: addressesFailed } = useIntakeAddresses(customer)
  if (!customer) return null

  const summary = [
    { label: 'Đơn đã mua', value: String(customer.orders), show: true },
    { label: 'Còn phải thu', value: currency(customer.debt), tone: customer.debt > 0 ? 'due' : 'paid', show: showDebt },
    {
      label: 'Vỏ đang giữ',
      value: `${customer.bottlesHeld} vỏ`,
      tone: customer.bottlesHeld > 0 ? 'warning' : undefined,
      show: showBottles,
    },
    { label: 'Cọc đang giữ', value: currency(customer.depositHeld), tone: 'deposit', show: showBottles },
  ].map((item) => (item.show ? item : { ...item, value: <Unsupported />, tone: undefined }))

  const archive = () =>
    modal.confirm({
      title: 'Lưu trữ hồ sơ?',
      content: (
        <div className="af-confirm-body">
          <p>
            <strong>{customer.name}</strong> sẽ không còn trong danh sách và ô chọn khách khi tạo đơn.
          </p>
          <p>Đơn, công nợ và sổ vỏ cũ vẫn giữ nguyên.</p>
        </div>
      ),
      centered: true,
      okText: 'Lưu trữ',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: () =>
        deactivate.mutateAsync(customer.id).then(
          () => {
            message.success(`Đã lưu trữ hồ sơ ${customer.name}.`)
            onClose()
          },
          (error: Error) => {
            message.error(error.message)
          },
        ),
    })

  const addressView = (
    <div className="af-cell-stack">
      {addressesFailed ? (
        'Không tải được địa chỉ.'
      ) : !addresses ? (
        'Đang tải địa chỉ...'
      ) : addresses.length ? (
        <ol className="af-address-view">
          {addresses.map((address) => (
            <li key={address.line}>
              {address.line}
              {address.area && ` · ${address.area}`}
              <MapLink address={[address.line, address.area].filter(Boolean).join(', ')} />{' '}
              {address.recipientName && (
                <small>
                  ({address.recipientName} · {address.recipientPhone})
                </small>
              )}{' '}
              {address.isDefault && <Tag color="blue">Mặc định</Tag>}
            </li>
          ))}
        </ol>
      ) : (
        'Chưa có địa chỉ giao'
      )}
      <Button size="small" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setManagingAddresses(true)}>
        Quản lý địa chỉ
      </Button>
    </div>
  )

  return (
    <>
      <Modal
        open
        centered
        onCancel={onClose}
        width={modalWidth.medium}
        styles={modalScrollBody}
        title={
          <div className="af-profile-head">
            <Avatar className="af-avatar" size={44}>
              {customer.initials}
            </Avatar>
            <div className="af-cell-stack">
              <span className="af-profile-name">{customer.name}</span>
              <small>
                {customerCode(customer)}
                {' · '}
                {showType ? <Tag className="af-inline-tag">{customer.type}</Tag> : <Unsupported label="Loại khách: chưa hỗ trợ" />}
              </small>
            </div>
          </div>
        }
        footer={
          <div className="af-order-footer">
            <div>
              {/* Lưu trữ ít khi dùng nên nằm trong menu Thao tác khác, không tô đỏ vì lịch sử vẫn giữ. */}
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [{ key: 'archive', label: 'Lưu trữ hồ sơ', danger: true, disabled: deactivate.isPending, onClick: archive }],
                }}
              >
                <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
              </Dropdown>
            </div>
            <div>
              <Button icon={<Pencil size={15} />} onClick={() => onEdit(customer)}>
                Sửa hồ sơ
              </Button>
              <Button type="primary" icon={<ShoppingBag size={15} />} onClick={() => onCreateOrder(customer)}>
                Tạo đơn
              </Button>
            </div>
          </div>
        }
      >
        <div className="af-profile-summary">
          {summary.map((item) => (
            <div key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: 'Thông tin',
              children: (
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'phone',
                      label: 'Điện thoại',
                      children: customer.phone ? (
                        <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="af-text-link">
                          <Phone size={14} /> {customer.phone}
                        </a>
                      ) : (
                        '—'
                      ),
                    },
                    { key: 'area', label: 'Khu vực', children: showExtras ? customer.area : <Unsupported /> },
                    { key: 'addresses', label: 'Địa chỉ giao', children: addressView },
                    { key: 'note', label: 'Ghi chú', children: showExtras ? customer.note || '—' : <Unsupported /> },
                  ]}
                />
              ),
            },
            {
              key: 'orders',
              label: `Đơn hàng (${customerOrders.length})`,
              children: (
                <Table<Order>
                  rowKey="id"
                  size="small"
                  loading={loadingOrders}
                  dataSource={customerOrders}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                  scroll={{ x: 560 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn trong hệ thống" /> }}
                  columns={[
                    {
                      title: 'Mã đơn',
                      dataIndex: 'id',
                      width: 130,
                      render: (id: string, order) => (
                        <Button type="link" size="small" onClick={() => setOrderId(id)}>
                          {order.code ?? id}
                        </Button>
                      ),
                    },
                    { title: 'Sản phẩm', dataIndex: 'items', ellipsis: true },
                    {
                      title: 'Tổng',
                      dataIndex: 'total',
                      align: 'right',
                      width: 110,
                      render: (total: number) => <span className="af-money">{currency(total)}</span>,
                    },
                    {
                      title: 'Trạng thái',
                      key: 'status',
                      width: 150,
                      render: (_, order) => (
                        <div className="af-cell-stack">
                          <span>
                            <OrderStatusTag status={order.status} method={order.method} />
                          </span>
                          <small>
                            {order.status === 'Đã hủy' ? (
                              ''
                            ) : showPayments && amountDue(order) > 0 ? (
                              <Money value={amountDue(order)} tone="due" prefix="Còn " />
                            ) : (
                              <span className="af-money is-paid">{paymentLabel(order)}</span>
                            )}
                          </small>
                        </div>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'bottles',
              label: 'Vỏ & cọc',
              children: <LiveBottleLedger customerId={customerId} />,
            },
          ]}
        />
      </Modal>
      {managingAddresses && (
        <LiveCustomerAddresses customerId={customer.id} customerName={customer.name} onClose={() => setManagingAddresses(false)} />
      )}
      {orderId && <OrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
