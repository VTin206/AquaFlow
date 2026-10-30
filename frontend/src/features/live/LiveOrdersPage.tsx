import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Descriptions, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { matchesSearch } from '../../shared/utils/search'
import { tablePagination } from '../../shared/utils/table'
import { useStaff } from '../auth/useStaff'
import { catalogApi } from './catalogApi'
import { canCancel, canConfirm, orderApi, orderStatusLabels, paymentStatusLabels, channelLabels, type LiveOrder, type OrderStatus } from './orderApi'
import { invalidateLiveData } from './invalidateLiveData'
import { LiveOrderDraftModal } from './LiveOrderDraftModal'

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'
const statusColors: Record<OrderStatus, string> = { PENDING: 'gold', CONFIRMED: 'blue', PREPARING: 'blue', OUT_FOR_DELIVERY: 'cyan', DELIVERED: 'green', COMPLETED: 'green', CANCELLED: 'default' }

function OrderDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const staff = useStaff()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['live', 'order', staff?.name, staff?.role, id], queryFn: () => orderApi.detail(id) })
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const update = useMutation({
    mutationFn: (status: 'CONFIRMED' | 'CANCELLED') => orderApi.updateStatus(id, status),
    onSuccess: (order) => {
      void invalidateLiveData(queryClient)
      message.success(order.status === 'CONFIRMED' ? `Đã xác nhận đơn ${order.orderCode} và giữ hàng trong kho.` : `Đã hủy đơn ${order.orderCode}.`)
    },
    // Đơn có thể đã đổi trạng thái ở nơi khác (409): tải lại để hiện trạng thái mới.
    onError: (error: Error) => { void invalidateLiveData(queryClient); message.error(error.message) },
  })
  const order = query.data
  const actions = order && (canConfirm(order) || canCancel(order)) ? <Space wrap>
    {canCancel(order) && <Popconfirm title={`Hủy đơn ${order.orderCode}?`} description={order.status === 'PENDING' ? 'Đơn chưa giữ hàng nên không ảnh hưởng tồn kho.' : 'Hàng đã giữ cho đơn sẽ được trả lại tồn kho.'} okText="Hủy đơn" okButtonProps={{ danger: true }} cancelText="Không" onConfirm={() => update.mutate('CANCELLED')}>
      <Button danger loading={update.isPending && update.variables === 'CANCELLED'} disabled={update.isPending}>Hủy đơn</Button>
    </Popconfirm>}
    {canConfirm(order) && <Popconfirm title={`Xác nhận đơn ${order.orderCode}?`} description="Hệ thống giữ hàng theo lô có hạn gần nhất. Nếu không đủ hàng khả dụng, đơn vẫn ở trạng thái chờ xác nhận." okText="Xác nhận" cancelText="Chưa" onConfirm={() => update.mutate('CONFIRMED')}>
      <Button type="primary" loading={update.isPending && update.variables === 'CONFIRMED'} disabled={update.isPending}>Xác nhận đơn</Button>
    </Popconfirm>}
  </Space> : null
  return <Modal open title={order ? `Đơn ${order.orderCode}` : 'Chi tiết đơn hàng'} width={850} onCancel={onClose} footer={<Space wrap><Button onClick={onClose}>Đóng</Button>{actions}</Space>}>
    {query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Card loading={query.isPending}>
      {order && <>
        <Descriptions column={{ xs: 1, sm: 2 }} items={[
          { key: 'customer', label: 'Người nhận', children: order.recipientName || 'Khách tại quầy' },
          { key: 'phone', label: 'Điện thoại', children: order.recipientPhone || '—' },
          { key: 'address', label: 'Địa chỉ', children: order.deliveryAddress || '—' },
          { key: 'area', label: 'Khu vực', children: order.deliveryArea || '—' },
          { key: 'status', label: 'Trạng thái', children: <Tag color={statusColors[order.status]}>{orderStatusLabels[order.status] ?? order.status}</Tag> },
          { key: 'payment', label: 'Thanh toán', children: paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus },
          { key: 'channel', label: 'Kênh', children: channelLabels[order.channel] ?? order.channel },
          { key: 'method', label: 'Nhận hàng', children: order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Tại quầy' },
          { key: 'created', label: 'Ngày tạo', children: dateTime(order.createdAt) },
          { key: 'appointment', label: 'Giờ hẹn', children: dateTime(order.requestedDeliveryAt) },
          { key: 'confirmed', label: 'Xác nhận lúc', children: dateTime(order.confirmedAt) },
          { key: 'cancelled', label: 'Hủy lúc', children: dateTime(order.cancelledAt) },
          { key: 'note', label: 'Ghi chú', children: order.note || '—' },
        ]} />
        {catalog.isError && <Alert type="warning" title="Không tải được tên sản phẩm; đang hiển thị mã định danh." action={<Button onClick={() => void catalog.refetch()}>Thử lại</Button>} />}
        <Table rowKey="id" dataSource={order.items} pagination={false} scroll={{ x: 550 }} columns={[
          { title: 'Sản phẩm', dataIndex: 'productId', render: (productId: number) => catalog.data?.find((product) => product.id === productId)?.name ?? `Sản phẩm #${productId}` },
          { title: 'Số lượng', dataIndex: 'quantity' }, { title: 'Đơn giá', dataIndex: 'unitPrice', render: currency }, { title: 'Thành tiền', dataIndex: 'lineTotal', render: currency },
        ]} />
        <div className="af-order-summary"><span>Tiền hàng</span><span>{currency(order.subtotal)}</span></div>
        <div className="af-order-summary"><span>Giảm giá</span><span>{currency(order.discountAmount)}</span></div>
        <div className="af-order-summary"><span>Phí giao</span><span>{currency(order.deliveryFee)}</span></div>
        <div className="af-order-summary"><strong>Tổng cộng</strong><strong>{currency(order.total)}</strong></div>
        {canConfirm(order) && <Alert type="warning" showIcon style={{ marginTop: 12 }} title="Đơn đang chờ xác nhận" description="Kiểm tra thông tin với khách rồi xác nhận để giữ hàng trong kho." />}
      </>}
    </Card>}
  </Modal>
}

export function LiveOrdersPage() {
  const staff = useStaff()
  const orders = useQuery({ queryKey: ['live', 'orders', staff?.name, staff?.role], queryFn: orderApi.list })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const visible = (orders.data ?? []).filter((order) => (status === 'all' || order.status === status) && matchesSearch(search, `${order.orderCode} ${order.recipientName ?? ''} ${order.recipientPhone ?? ''}`, order.recipientPhone ?? ''))
  const pending = (orders.data ?? []).filter(canConfirm).length
  return <Page title="Đơn hàng" description="Tạo, xác nhận và hủy đơn hàng." actions={<Button type="primary" onClick={() => setCreating(true)}>Tạo đơn hàng</Button>}>
    {pending > 0 && status !== 'PENDING' && <Alert type="warning" showIcon title={`Có ${pending} đơn đang chờ xác nhận.`} action={<Button size="small" onClick={() => setStatus('PENDING')}>Xem đơn chờ</Button>} style={{ marginBottom: 16 }} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input aria-label="Tìm đơn hàng" placeholder="Mã đơn, người nhận, điện thoại" allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Trạng thái đơn" value={status} onChange={setStatus} style={{ minWidth: 180 }} options={[{ value: 'all', label: 'Mọi trạng thái' }, ...Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label }))]} />
        <Button onClick={() => void orders.refetch()} loading={orders.isFetching}>Làm mới</Button>
      </Space>
      {orders.isError ? <QueryError error={orders.error} onRetry={orders.refetch} /> : <Table<LiveOrder> key={JSON.stringify([search, status])} rowKey="id" loading={orders.isPending} dataSource={visible} pagination={tablePagination} scroll={{ x: 900 }} locale={{ emptyText: 'Không có đơn hàng phù hợp.' }} columns={[
        { title: 'Mã đơn', dataIndex: 'orderCode', render: (value, order) => <Button type="link" onClick={() => setSelected(order.id)}>{value}</Button> },
        { title: 'Người nhận', dataIndex: 'recipientName', render: (value) => value || 'Khách tại quầy' },
        { title: 'Điện thoại', dataIndex: 'recipientPhone' },
        { title: 'Ngày tạo', dataIndex: 'createdAt', render: dateTime },
        { title: 'Trạng thái', dataIndex: 'status', render: (value: LiveOrder['status']) => <Tag color={statusColors[value]}>{orderStatusLabels[value] ?? value}</Tag> },
        { title: 'Thanh toán', dataIndex: 'paymentStatus', render: (value: LiveOrder['paymentStatus']) => paymentStatusLabels[value] ?? value },
        { title: 'Tổng tiền', dataIndex: 'total', render: currency },
        { title: 'Thao tác', render: (_, order) => <Button type={canConfirm(order) ? 'primary' : 'default'} ghost={canConfirm(order)} onClick={() => setSelected(order.id)}>{canConfirm(order) ? 'Xem & xác nhận' : 'Chi tiết'}</Button> },
      ]} />}
    </Card>
    {selected !== null && <OrderDetails key={selected} id={selected} onClose={() => setSelected(null)} />}
    {creating && <LiveOrderDraftModal onClose={() => setCreating(false)} onCreated={(order) => { setCreating(false); setSelected(order.id) }} />}
  </Page>
}
