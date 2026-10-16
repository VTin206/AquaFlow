import { useState } from 'react'
import { Avatar, Button, Descriptions, Drawer, Empty, Space, Table, Tabs, Tag, Typography } from 'antd'
import { Pencil, Phone, ShoppingBag } from 'lucide-react'
import { Money } from '../../../shared/components/Money'
import { currency } from '../../../shared/utils/format'
import { can } from '../../auth/permissions'
import { useStaff } from '../../auth/useStaff'
import { OrderDetailsModal } from '../../orders/components/OrderDetailsModal'
import { OrderStatusTag } from '../../orders/components/OrderStatusTag'
import { amountDue, paymentLabel, type Order } from '../../orders/types'
import { useOrders } from '../../orders/useOrders'
import { refundableOf, type BottleEntry, type Customer } from '../types'
import { useBottleLedger, useCustomers } from '../useCustomers'
import { BottleActionModal, type BottleActionKind } from './BottleActionModal'

type CustomerDrawerProps = { customerId: string; onClose: () => void; onEdit: (customer: Customer) => void; onCreateOrder: (customer: Customer) => void }

const signed = (value: number, render: (value: number) => string = String) => (value > 0 ? `+${render(value)}` : value < 0 ? `−${render(-value)}` : '—')

/** Hồ sơ khách: liên hệ, đơn hàng, công nợ và sổ vỏ/cọc trong một ngăn kéo. */
export function CustomerDrawer({ customerId, onClose, onEdit, onCreateOrder }: CustomerDrawerProps) {
  const staff = useStaff()
  // Hoàn cọc, báo mất/vỡ làm đổi tiền cọc nên chỉ chủ cửa hàng thấy.
  const canAdjust = !staff || can(staff.role, 'adjustBottles')
  const { data: customers = [] } = useCustomers()
  const { data: orders = [] } = useOrders()
  const ledgerQuery = useBottleLedger(customerId)
  const [bottleAction, setBottleAction] = useState<BottleActionKind | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const customer = customers.find((item) => item.id === customerId)
  if (!customer) return null

  const customerOrders = orders.filter((order) => order.customerId === customer.id)
  const refundable = refundableOf(customer)

  const summary = [
    { label: 'Đơn đã mua', value: String(customer.orders) },
    { label: 'Còn phải thu', value: currency(customer.debt), tone: customer.debt > 0 ? 'due' : 'paid' },
    { label: 'Vỏ đang giữ', value: `${customer.bottlesHeld} vỏ`, tone: customer.bottlesHeld > 0 ? 'warning' : undefined },
    { label: 'Cọc đang giữ', value: currency(customer.depositHeld), tone: 'deposit' },
  ]

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size={640}
        title={
          <div className="af-profile-head">
            <Avatar className="af-avatar" size={44}>{customer.initials}</Avatar>
            <div className="af-cell-stack">
              <span className="af-profile-name">{customer.name}</span>
              <small>
                {customer.id} · <Tag className="af-inline-tag">{customer.type}</Tag>
              </small>
            </div>
          </div>
        }
        extra={
          <Space className="af-drawer-actions">
            <Button icon={<Pencil size={15} />} aria-label="Sửa hồ sơ" onClick={() => onEdit(customer)}>
              Sửa
            </Button>
            <Button type="primary" icon={<ShoppingBag size={15} />} aria-label="Tạo đơn" onClick={() => onCreateOrder(customer)}>
              Tạo đơn
            </Button>
          </Space>
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
                      children: (
                        <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="af-text-link">
                          <Phone size={14} /> {customer.phone}
                        </a>
                      ),
                    },
                    { key: 'area', label: 'Khu vực', children: customer.area },
                    {
                      key: 'addresses',
                      label: 'Địa chỉ giao',
                      children: customer.addresses.length ? (
                        <ol className="af-address-view">
                          {customer.addresses.map((address) => (
                            <li key={address}>{address}</li>
                          ))}
                        </ol>
                      ) : (
                        'Chưa có địa chỉ giao'
                      ),
                    },
                    { key: 'note', label: 'Ghi chú', children: customer.note || '—' },
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
                  dataSource={customerOrders}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                  scroll={{ x: 560 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn trong hệ thống" /> }}
                  columns={[
                    {
                      title: 'Mã đơn',
                      dataIndex: 'id',
                      width: 100,
                      render: (id: string) => (
                        <Button type="link" size="small" onClick={() => setOrderId(id)}>
                          {id}
                        </Button>
                      ),
                    },
                    { title: 'Sản phẩm', dataIndex: 'items', ellipsis: true },
                    { title: 'Tổng', dataIndex: 'total', align: 'right', width: 110, render: (total: number) => <span className="af-money">{currency(total)}</span> },
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
                            {order.status === 'Đã hủy' ? '' : amountDue(order) > 0 ? <Money value={amountDue(order)} tone="due" prefix="Còn " /> : <span className="af-money is-paid">{paymentLabel(order)}</span>}
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
              children: (
                <>
                  <div className="af-bottle-balance">
                    <span>
                      Đang giữ <strong>{customer.bottlesHeld} vỏ</strong> · cọc <Money value={customer.depositHeld} tone="deposit" />
                    </span>
                    {refundable > 0 && <Tag color="green">Có thể hoàn {currency(refundable)}</Tag>}
                  </div>
                  <Space wrap className="af-bottle-actions">
                    <Button onClick={() => setBottleAction('Thu vỏ')} disabled={customer.bottlesHeld === 0}>
                      Thu vỏ
                    </Button>
                    <Button onClick={() => setBottleAction('Thu cọc')}>Thu cọc</Button>
                    {canAdjust && (
                      <>
                        <Button onClick={() => setBottleAction('Hoàn cọc')} disabled={refundable === 0} title={refundable === 0 ? 'Khách chưa trả đủ vỏ để hoàn cọc' : undefined}>
                          Hoàn cọc
                        </Button>
                        <Button danger onClick={() => setBottleAction('Báo mất/vỡ')} disabled={customer.bottlesHeld === 0}>
                          Báo mất/vỡ
                        </Button>
                      </>
                    )}
                  </Space>
                  <Table<BottleEntry>
                    rowKey="id"
                    size="small"
                    loading={ledgerQuery.isPending}
                    dataSource={ledgerQuery.data}
                    pagination={{ pageSize: 8, hideOnSinglePage: true }}
                    scroll={{ x: 560 }}
                    locale={{ emptyText: 'Chưa có giao dịch vỏ.' }}
                    columns={[
                      {
                        title: 'Thời điểm',
                        dataIndex: 'at',
                        width: 120,
                        render: (at: string) => new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                      },
                      {
                        title: 'Nghiệp vụ',
                        dataIndex: 'kind',
                        render: (_, entry) => (
                          <div className="af-cell-stack">
                            <span>{entry.kind}</span>
                            <small>{entry.orderId ?? entry.note ?? ''}</small>
                          </div>
                        ),
                      },
                      { title: 'Vỏ', dataIndex: 'bottles', align: 'right', width: 60, render: (value: number) => signed(value) },
                      { title: 'Cọc', dataIndex: 'deposit', align: 'right', width: 120, render: (value: number) => signed(value, currency) },
                    ]}
                  />
                  <Typography.Paragraph type="secondary" className="af-form-hint">
                    Số dư được cộng dồn từ sổ, không sửa trực tiếp. Sai sót được điều chỉnh bằng một dòng nghiệp vụ mới.
                  </Typography.Paragraph>
                </>
              ),
            },
          ]}
        />
      </Drawer>
      <BottleActionModal customer={customer} kind={bottleAction} refundable={refundable} onClose={() => setBottleAction(null)} />
      {orderId && <OrderDetailsModal key={orderId} orderId={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
