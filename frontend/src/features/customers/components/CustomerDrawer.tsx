import { useState } from 'react'
import { App, Avatar, Button, Descriptions, Drawer, Dropdown, Empty, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { Ellipsis, Pencil, Phone, ShoppingBag } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { useFeature, useIsDemo } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { currency } from '@/shared/utils/format'
import { can } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'
import { OrderStatusTag } from '@/features/orders/components/OrderStatusTag'
import { amountDue, paymentLabel, type Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { LiveCustomerAddresses } from '@/features/live/LiveCustomerAddresses'
import { orderStatusLabels, type LiveOrder } from '@/features/live/orderApi'
import { customerCode, refundableOf, type BottleEntry, type Customer } from '../types'
import { useBottleLedger, useCustomers, useDeactivateCustomer, useLiveAddresses, useLiveCustomerOrders } from '../useCustomers'
import { BottleActionModal, type BottleActionKind } from './BottleActionModal'

type CustomerDrawerProps = {
  customerId: string
  onClose: () => void
  onEdit: (customer: Customer) => void
  onCreateOrder: (customer: Customer) => void
}

const signed = (value: number, render: (value: number) => string = String) =>
  value > 0 ? `+${render(value)}` : value < 0 ? `−${render(-value)}` : '—'

/** Hồ sơ khách: liên hệ, đơn hàng, công nợ và sổ vỏ/cọc trong một ngăn kéo. */
export function CustomerDrawer({ customerId, onClose, onEdit, onCreateOrder }: CustomerDrawerProps) {
  const staff = useStaff()
  const { message, modal } = App.useApp()
  const demo = useIsDemo()
  const showType = useFeature('customerType')
  const showExtras = useFeature('customerProfileExtras')
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')
  // Hoàn cọc, báo mất/vỡ làm đổi tiền cọc nên chỉ chủ cửa hàng thấy.
  const canAdjust = !staff || can(staff.role, 'adjustBottles')
  const { data: customers = [] } = useCustomers()
  const { data: orders = [] } = useOrders()
  const ledgerQuery = useBottleLedger(customerId)
  const liveOrders = useLiveCustomerOrders(customerId)
  const liveAddresses = useLiveAddresses(customerId)
  const deactivate = useDeactivateCustomer()
  const [managingAddresses, setManagingAddresses] = useState(false)
  const [bottleAction, setBottleAction] = useState<BottleActionKind | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const customer = customers.find((item) => item.id === customerId)
  if (!customer) return null

  const customerOrders = orders.filter((order) => order.customerId === customer.id)
  const refundable = refundableOf(customer)
  const orderCount = demo ? customerOrders.length : (liveOrders.data?.length ?? 0)

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

  const addressView = demo ? (
    customer.addresses.length ? (
      <ol className="af-address-view">
        {customer.addresses.map((address) => (
          <li key={address}>{address}</li>
        ))}
      </ol>
    ) : (
      'Chưa có địa chỉ giao'
    )
  ) : (
    <div className="af-cell-stack">
      {liveAddresses.isPending ? (
        'Đang tải địa chỉ...'
      ) : liveAddresses.isError ? (
        'Không tải được địa chỉ.'
      ) : liveAddresses.data.length ? (
        <ol className="af-address-view">
          {liveAddresses.data.map((address) => (
            <li key={address.id}>
              {address.addressLine}
              {address.area && ` · ${address.area}`}{' '}
              <small>
                ({address.recipientName} · {address.recipientPhone})
              </small>{' '}
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
      <Drawer
        open
        onClose={onClose}
        size={640}
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
        extra={
          <Space className="af-drawer-actions">
            <Button type="primary" icon={<ShoppingBag size={15} />} aria-label="Tạo đơn" onClick={() => onCreateOrder(customer)}>
              Tạo đơn
            </Button>
            <Tooltip title="Sửa hồ sơ">
              <Button icon={<Pencil size={15} />} aria-label="Sửa hồ sơ" onClick={() => onEdit(customer)} />
            </Tooltip>
            {/* Lưu trữ ít khi dùng nên nằm trong menu ⋯, không tô đỏ vì lịch sử vẫn giữ. */}
            <Dropdown
              trigger={['click']}
              menu={{ items: [{ key: 'archive', label: 'Lưu trữ hồ sơ', danger: true, disabled: deactivate.isPending, onClick: archive }] }}
            >
              <Button icon={<Ellipsis size={16} />} aria-label="Thao tác khác" />
            </Dropdown>
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
              label: `Đơn hàng (${orderCount})`,
              children: !demo ? (
                <Table<LiveOrder>
                  rowKey="id"
                  size="small"
                  loading={liveOrders.isPending}
                  dataSource={liveOrders.data}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                  scroll={{ x: 520 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn trong hệ thống" /> }}
                  columns={[
                    { title: 'Mã đơn', dataIndex: 'orderCode', width: 130 },
                    {
                      title: 'Ngày tạo',
                      dataIndex: 'createdAt',
                      width: 110,
                      render: (at: string) => new Date(at).toLocaleDateString('vi-VN'),
                    },
                    {
                      title: 'Tổng',
                      dataIndex: 'total',
                      align: 'right',
                      width: 110,
                      render: (total: number) => <span className="af-money">{currency(total)}</span>,
                    },
                    {
                      title: 'Trạng thái',
                      dataIndex: 'status',
                      width: 130,
                      render: (status: LiveOrder['status']) => <Tag>{orderStatusLabels[status] ?? status}</Tag>,
                    },
                  ]}
                />
              ) : (
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
                            ) : amountDue(order) > 0 ? (
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
              children: !showBottles ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tính năng đang phát triển — chờ backend bổ sung." />
              ) : (
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
                        <Button
                          onClick={() => setBottleAction('Hoàn cọc')}
                          disabled={refundable === 0}
                          title={refundable === 0 ? 'Khách chưa trả đủ vỏ để hoàn cọc' : undefined}
                        >
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
                        render: (at: string) =>
                          new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
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
                      {
                        title: 'Cọc',
                        dataIndex: 'deposit',
                        align: 'right',
                        width: 120,
                        render: (value: number) => signed(value, currency),
                      },
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
      {managingAddresses && (
        <LiveCustomerAddresses customerId={Number(customer.id)} customerName={customer.name} onClose={() => setManagingAddresses(false)} />
      )}
      <BottleActionModal customer={customer} kind={bottleAction} refundable={refundable} onClose={() => setBottleAction(null)} />
      {orderId && <OrderDetailsModal key={orderId} orderId={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
