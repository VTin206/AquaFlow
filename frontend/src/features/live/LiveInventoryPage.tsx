import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Descriptions, Input, Modal, Popconfirm, Segmented, Space, Table, Tabs, Tag, Typography } from 'antd'
import { CountLabel } from '../../shared/components/CountLabel'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { matchesSearch } from '../../shared/utils/search'
import { tablePagination } from '../../shared/utils/table'
import { useStaff } from '../auth/useStaff'
import { EXPIRY_WARNING_DAYS, daysUntilExpiry, isoToVnDate } from '../inventory/expiry'
import { inventoryApi, receiptCode, receiptStatusColors, receiptStatusLabels, receiptTotal, type BatchStock, type ProductStock, type PurchaseReceipt, type ReceiptStatus } from './inventoryApi'
import { invalidateLiveData } from './invalidateLiveData'
import { LiveReceiptModal, ReceiptResult } from './LiveReceiptModal'

type LotRow = BatchStock & { productId: number; sku: string; productName: string; daysLeft: number | null }
type LotFilter = 'stock' | 'expiring' | 'expired' | 'all'
type ReceiptFilter = 'all' | ReceiptStatus

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN')
/** Lô hết hạn theo BE (cờ expired) luôn ưu tiên; sắp hết hạn tính theo ngưỡng cảnh báo của FE. */
const lotState = (lot: LotRow) => lot.expired ? 'expired' : lot.daysLeft !== null && lot.daysLeft <= EXPIRY_WARNING_DAYS ? 'expiring' : 'fresh'

function LotStatus({ lot }: { lot: LotRow }) {
  const state = lotState(lot)
  if (state === 'expired') return <Tag color="red">Đã hết hạn</Tag>
  if (state === 'expiring') return <Tag color="gold">Còn {lot.daysLeft} ngày</Tag>
  return <Tag color="green">Còn hạn</Tag>
}

function StockTab({ stock }: { stock: ProductStock[] }) {
  const [search, setSearch] = useState('')
  const visible = stock.filter((item) => matchesSearch(search, `${item.productName} ${item.sku}`))
  return <>
    <Input aria-label="Tìm trong kho hàng" placeholder="Tìm mã, tên sản phẩm" allowClear value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 360, marginBottom: 16 }} />
    <Table<ProductStock> key={search} rowKey="productId" dataSource={visible} pagination={tablePagination} scroll={{ x: 900 }} locale={{ emptyText: stock.length ? 'Không có sản phẩm phù hợp.' : 'Chưa có hàng trong kho. Tạo phiếu nhập và xác nhận nhập kho để cộng tồn.' }} columns={[
      { title: 'Mã sản phẩm', dataIndex: 'sku' },
      { title: 'Sản phẩm', dataIndex: 'productName' },
      { title: 'Tồn thực tế', dataIndex: 'onHand', align: 'right', sorter: (a, b) => a.onHand - b.onHand },
      { title: 'Đã giữ', dataIndex: 'reserved', align: 'right' },
      { title: 'Khả dụng', dataIndex: 'available', align: 'right', sorter: (a, b) => a.available - b.available, render: (value: number) => <strong>{value}</strong> },
      { title: 'Số lô', key: 'lots', align: 'right', render: (_, item) => item.batches.filter((batch) => batch.onHand > 0).length },
      { title: 'Cảnh báo', key: 'warning', render: (_, item) => item.expiredOnHand > 0 ? <Tag color="red">{item.expiredOnHand} hết hạn chưa xử lý</Tag> : item.available === 0 ? <Tag color="red">Hết hàng</Tag> : null },
    ]} />
  </>
}

function LotsTab({ stock }: { stock: ProductStock[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LotFilter>('stock')
  const lots: LotRow[] = stock.flatMap((item) => item.batches.map((batch) => ({ ...batch, productId: item.productId, sku: item.sku, productName: item.productName, daysLeft: daysUntilExpiry(isoToVnDate(batch.expiresOn)) })))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
  const inStock = lots.filter((lot) => lot.onHand > 0)
  const expiring = inStock.filter((lot) => lotState(lot) === 'expiring')
  const expired = inStock.filter((lot) => lotState(lot) === 'expired')
  const visible = (filter === 'stock' ? inStock : filter === 'expiring' ? expiring : filter === 'expired' ? expired : lots)
    .filter((lot) => matchesSearch(search, `${lot.lotCode} ${lot.productName} ${lot.sku}`))
  return <>
    {(expiring.length > 0 || expired.length > 0) && <Alert type={expired.length ? 'error' : 'warning'} showIcon style={{ marginBottom: 16 }}
      title={[expired.length && `${expired.length} lô đã hết hạn còn trong kho`, expiring.length && `${expiring.length} lô hết hạn trong ${EXPIRY_WARNING_DAYS} ngày`].filter(Boolean).join(' · ')}
      description="Lô hết hạn không được bán (khả dụng = 0). Ưu tiên xuất lô có hạn gần nhất." />}
    <Space wrap style={{ marginBottom: 16 }}>
      <Segmented<LotFilter> value={filter} onChange={setFilter} options={[
        { value: 'stock', label: <CountLabel label="Còn hàng" count={inStock.length} /> },
        { value: 'expiring', label: <CountLabel label="Sắp hết hạn" count={expiring.length} urgent /> },
        { value: 'expired', label: <span className="af-text-danger"><CountLabel label="Đã hết hạn" count={expired.length} /></span> },
        { value: 'all', label: <CountLabel label="Tất cả lô" count={lots.length} /> },
      ]} />
      <Input aria-label="Tìm lô hàng" placeholder="Tìm mã lô, sản phẩm" allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
    </Space>
    <Table<LotRow> key={`${filter}:${search}`} rowKey="batchId" dataSource={visible} pagination={tablePagination} scroll={{ x: 850 }} locale={{ emptyText: lots.length ? 'Không có lô phù hợp.' : 'Chưa có lô hàng nào.' }} columns={[
      { title: 'Mã lô', dataIndex: 'lotCode' },
      { title: 'Sản phẩm', dataIndex: 'productName', render: (value, lot) => <>{value}<br /><Typography.Text type="secondary">{lot.sku}</Typography.Text></> },
      { title: 'Hạn sử dụng', dataIndex: 'expiresOn', render: isoToVnDate },
      { title: 'Tồn thực tế', dataIndex: 'onHand', align: 'right' },
      { title: 'Đã giữ', dataIndex: 'reserved', align: 'right' },
      { title: 'Khả dụng', dataIndex: 'available', align: 'right' },
      { title: 'Cảnh báo', key: 'status', render: (_, lot) => <LotStatus lot={lot} /> },
    ]} />
  </>
}

function ReceiptDetails({ id, onEdit, onClose }: { id: number; onEdit: (receipt: PurchaseReceipt) => void; onClose: () => void }) {
  const staff = useStaff()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['live', 'receipt', staff?.name, staff?.role, id], queryFn: () => inventoryApi.receipt(id) })
  const [confirmed, setConfirmed] = useState<PurchaseReceipt>()
  const action = useMutation({
    mutationFn: (kind: 'confirm' | 'cancel') => kind === 'confirm' ? inventoryApi.confirmReceipt(id) : inventoryApi.cancelReceipt(id),
    onSuccess: (receipt) => {
      void invalidateLiveData(queryClient)
      if (receipt.status === 'CONFIRMED') return setConfirmed(receipt)
      message.success(`Đã hủy phiếu ${receiptCode(receipt)}.`)
      onClose()
    },
    onError: (error: Error) => { void invalidateLiveData(queryClient); message.error(error.message) },
  })
  const receipt = query.data
  if (confirmed) return <Modal open title="Kết quả nhập kho" width={880} onCancel={onClose} footer={null}><ReceiptResult receipt={confirmed} onClose={onClose} /></Modal>
  return <Modal open title={receipt ? `Phiếu nhập ${receiptCode(receipt)}` : 'Chi tiết phiếu nhập'} width={880} onCancel={onClose} footer={receipt?.status === 'DRAFT'
    ? <Space wrap>
      <Popconfirm title="Hủy phiếu nháp này?" description="Phiếu đã hủy không dùng lại được." okText="Hủy phiếu" okButtonProps={{ danger: true }} cancelText="Không" onConfirm={() => action.mutate('cancel')}><Button danger loading={action.isPending && action.variables === 'cancel'} disabled={action.isPending}>Hủy phiếu</Button></Popconfirm>
      <Button disabled={action.isPending} onClick={() => onEdit(receipt)}>Sửa phiếu</Button>
      <Popconfirm title="Xác nhận nhập kho?" description="Số lượng nhập kho sẽ được cộng vào tồn; sau đó không sửa hoặc hủy phiếu được." okText="Nhập kho" cancelText="Chưa" onConfirm={() => action.mutate('confirm')}><Button type="primary" loading={action.isPending && action.variables === 'confirm'} disabled={action.isPending}>Xác nhận nhập kho</Button></Popconfirm>
    </Space>
    : <Button onClick={onClose}>Đóng</Button>}>
    {query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Card loading={query.isPending} variant="borderless" styles={{ body: { padding: 0 } }}>
      {receipt && <>
        <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }} items={[
          { key: 'supplier', label: 'Nhà cung cấp', children: receipt.supplierName },
          { key: 'status', label: 'Trạng thái', children: <Tag color={receiptStatusColors[receipt.status]}>{receiptStatusLabels[receipt.status]}</Tag> },
          { key: 'received', label: 'Ngày nhận', children: date(receipt.receivedAt) },
          { key: 'confirmed', label: 'Nhập kho lúc', children: dateTime(receipt.confirmedAt) },
          { key: 'note', label: 'Ghi chú', children: receipt.note || '—', span: 2 },
        ]} />
        <Table rowKey="id" dataSource={receipt.items} pagination={false} scroll={{ x: 750 }} columns={[
          { title: 'Sản phẩm', dataIndex: 'productName' },
          { title: 'Mã lô', dataIndex: 'lotCode' },
          { title: 'NSX', dataIndex: 'manufacturedOn', render: (value: string | null) => value ? isoToVnDate(value) : '—' },
          { title: 'HSD', dataIndex: 'expiresOn', render: isoToVnDate },
          { title: 'Nhận', dataIndex: 'quantityReceived', align: 'right' },
          { title: 'Nhập kho', dataIndex: 'quantityAccepted', align: 'right' },
          { title: 'Loại', dataIndex: 'quantityRejected', align: 'right' },
          { title: 'Giá nhập', dataIndex: 'unitCost', align: 'right', render: currency },
          { title: 'Thành tiền', key: 'lineTotal', align: 'right', render: (_, item) => currency(item.quantityAccepted * item.unitCost) },
        ]} />
        <div className="af-order-summary" style={{ marginTop: 12 }}><span>Giá trị nhập kho</span><strong>{currency(receiptTotal(receipt))}</strong></div>
      </>}
    </Card>}
  </Modal>
}

function ReceiptsTab({ receipts, onOpen }: { receipts: PurchaseReceipt[]; onOpen: (id: number) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ReceiptFilter>('all')
  const count = (status: ReceiptStatus) => receipts.filter((receipt) => receipt.status === status).length
  const visible = receipts.filter((receipt) => (filter === 'all' || receipt.status === filter) && matchesSearch(search, `${receiptCode(receipt)} ${receipt.supplierName} ${receipt.items.map((item) => `${item.lotCode} ${item.productName}`).join(' ')}`))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id - a.id)
  return <>
    <Space wrap style={{ marginBottom: 16 }}>
      <Segmented<ReceiptFilter> value={filter} onChange={setFilter} options={[
        { value: 'all', label: <CountLabel label="Tất cả" count={receipts.length} /> },
        { value: 'DRAFT', label: <CountLabel label="Nháp" count={count('DRAFT')} urgent /> },
        { value: 'CONFIRMED', label: <CountLabel label="Đã nhập kho" count={count('CONFIRMED')} /> },
        { value: 'CANCELLED', label: <CountLabel label="Đã hủy" count={count('CANCELLED')} /> },
      ]} />
      <Input aria-label="Tìm phiếu nhập" placeholder="Mã phiếu, nhà cung cấp, mã lô" allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
    </Space>
    <Table<PurchaseReceipt> key={`${filter}:${search}`} rowKey="id" dataSource={visible} pagination={tablePagination} scroll={{ x: 800 }} locale={{ emptyText: receipts.length ? 'Không có phiếu phù hợp.' : 'Chưa có phiếu nhập nào.' }} columns={[
      { title: 'Mã phiếu', key: 'code', render: (_, receipt) => <Button type="link" style={{ padding: 0 }} onClick={() => onOpen(receipt.id)}>{receiptCode(receipt)}</Button> },
      { title: 'Nhà cung cấp', dataIndex: 'supplierName' },
      { title: 'Ngày nhận', dataIndex: 'receivedAt', render: date },
      { title: 'Số dòng', key: 'lines', align: 'right', render: (_, receipt) => receipt.items.length },
      { title: 'Giá trị nhập', key: 'total', align: 'right', render: (_, receipt) => currency(receiptTotal(receipt)) },
      { title: 'Trạng thái', dataIndex: 'status', render: (value: ReceiptStatus) => <Tag color={receiptStatusColors[value]}>{receiptStatusLabels[value]}</Tag> },
      { title: 'Thao tác', key: 'actions', render: (_, receipt) => <Button onClick={() => onOpen(receipt.id)}>{receipt.status === 'DRAFT' ? 'Xem / nhập kho' : 'Chi tiết'}</Button> },
    ]} />
  </>
}

export function LiveInventoryPage() {
  const staff = useStaff()
  const stock = useQuery({ queryKey: ['live', 'stock', staff?.name, staff?.role], queryFn: inventoryApi.stock })
  const receipts = useQuery({ queryKey: ['live', 'receipts', staff?.name, staff?.role], queryFn: inventoryApi.receipts })
  const [tab, setTab] = useState('stock')
  const [editing, setEditing] = useState<PurchaseReceipt | null>()
  const [viewing, setViewing] = useState<number | null>(null)
  const drafts = (receipts.data ?? []).filter((receipt) => receipt.status === 'DRAFT').length
  return <Page title="Kho hàng" description="Tồn kho theo lô, hạn sử dụng và phiếu nhập hàng." actions={<Space wrap>
    <Button onClick={() => { void stock.refetch(); void receipts.refetch() }} loading={stock.isFetching || receipts.isFetching}>Làm mới</Button>
    <Button type="primary" onClick={() => setEditing(null)}>Tạo phiếu nhập</Button>
  </Space>}>
    {drafts > 0 && tab !== 'receipts' && <Alert type="info" showIcon style={{ marginBottom: 16 }} title={`Có ${drafts} phiếu nhập nháp chưa nhập kho.`} action={<Button size="small" onClick={() => setTab('receipts')}>Xem phiếu</Button>} />}
    <Card>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'stock', label: 'Tồn kho', children: stock.isError ? <QueryError error={stock.error} onRetry={stock.refetch} /> : stock.isPending ? <Card loading variant="borderless" /> : <StockTab stock={stock.data} /> },
        { key: 'lots', label: 'Lô hàng', children: stock.isError ? <QueryError error={stock.error} onRetry={stock.refetch} /> : stock.isPending ? <Card loading variant="borderless" /> : <LotsTab stock={stock.data} /> },
        { key: 'receipts', label: 'Phiếu nhập', children: receipts.isError ? <QueryError error={receipts.error} onRetry={receipts.refetch} /> : receipts.isPending ? <Card loading variant="borderless" /> : <ReceiptsTab receipts={receipts.data} onOpen={setViewing} /> },
      ]} />
    </Card>
    {viewing !== null && <ReceiptDetails key={viewing} id={viewing} onClose={() => setViewing(null)} onEdit={(receipt) => { setViewing(null); setEditing(receipt) }} />}
    {editing !== undefined && <LiveReceiptModal key={editing?.id ?? 'new'} receipt={editing ?? undefined} onClose={() => setEditing(undefined)} />}
  </Page>
}
