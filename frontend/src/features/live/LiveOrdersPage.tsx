import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { matchesSearch } from '../../shared/utils/search'
import { tablePagination } from '../../shared/utils/table'
import { useStaff } from '../auth/useStaff'
import { catalogApi } from './catalogApi'
import { orderApi, orderStatusLabels, paymentStatusLabels, channelLabels, type LiveOrder } from './orderApi'
import { LiveOrderDraftModal } from './LiveOrderDraftModal'

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'

function OrderDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const staff = useStaff()
  const query = useQuery({ queryKey: ['live', 'order', staff?.name, staff?.role, id], queryFn: () => orderApi.detail(id) })
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const order = query.data
  return <Modal open title={order ? `Đơn ${order.orderCode}` : 'Chi tiết đơn hàng'} width={850} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
    {query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Card loading={query.isPending}>
      {order && <>
        <Descriptions column={{ xs: 1, sm: 2 }} items={[
          { key: 'customer', label: 'Người nhận', children: order.recipientName || 'Khách tại quầy' },
          { key: 'phone', label: 'Điện thoại', children: order.recipientPhone || '—' },
          { key: 'address', label: 'Địa chỉ', children: order.deliveryAddress || '—' },
          { key: 'area', label: 'Khu vực', children: order.deliveryArea || '—' },
          { key: 'status', label: 'Trạng thái', children: orderStatusLabels[order.status] ?? order.status },
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
        <Alert type="info" showIcon title="Chưa thể xác nhận hoặc hủy đơn trên màn hình này" description="Các thao tác cập nhật đơn đang được hoàn thiện. Trạng thái trên là dữ liệu hiện có của hệ thống." />
        <Space style={{ marginTop: 12 }}><Button type="primary" disabled>Xác nhận đơn</Button><Button danger disabled>Hủy đơn</Button></Space>
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
  return <Page title="Đơn hàng" description="Danh sách và chi tiết đơn đã ghi nhận trong hệ thống." actions={<Button type="primary" onClick={() => setCreating(true)}>Chuẩn bị đơn hàng</Button>}>
    <Alert type="info" showIcon title="Hiện hỗ trợ xem đơn hàng" description="Tạo, xác nhận và hủy đơn chưa khả dụng. Bạn có thể chuẩn bị thông tin trong form." style={{ marginBottom: 16 }} />
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
        { title: 'Trạng thái', dataIndex: 'status', render: (value: LiveOrder['status']) => <Tag>{orderStatusLabels[value] ?? value}</Tag> },
        { title: 'Thanh toán', dataIndex: 'paymentStatus', render: (value: LiveOrder['paymentStatus']) => paymentStatusLabels[value] ?? value },
        { title: 'Tổng tiền', dataIndex: 'total', render: currency },
        { title: 'Thao tác', render: (_, order) => <Button onClick={() => setSelected(order.id)}>Chi tiết</Button> },
      ]} />}
    </Card>
    {selected !== null && <OrderDetails key={selected} id={selected} onClose={() => setSelected(null)} />}
    {creating && <LiveOrderDraftModal onClose={() => setCreating(false)} />}
  </Page>
}
