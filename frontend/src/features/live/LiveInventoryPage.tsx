import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Input, Select, Space, Table, Tabs, Typography } from 'antd'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { matchesSearch } from '../../shared/utils/search'
import { tablePagination } from '../../shared/utils/table'
import { catalogApi } from './catalogApi'
import { LiveReceiptModal } from './LiveReceiptModal'

export function LiveInventoryPage() {
  const products = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const [search, setSearch] = useState('')
  const [receiving, setReceiving] = useState(false)
  const visible = (products.data ?? []).filter((product) => matchesSearch(search, `${product.name} ${product.sku}`))
  const unknown = () => <Typography.Text type="secondary">Chưa có dữ liệu</Typography.Text>
  return <Page title="Kho hàng" description="Danh mục hàng, tồn kho, lô và phiếu nhập." actions={<Button type="primary" onClick={() => setReceiving(true)}>Chuẩn bị phiếu nhập</Button>}>
    <Alert type="info" showIcon title="Số liệu kho đang chờ cập nhật" description="Danh mục sản phẩm đã kết nối. Tồn thực tế, số đã giữ, khả dụng, lô và phiếu nhập chưa có dữ liệu; chưa thể xác nhận nhập kho." style={{ marginBottom: 16 }} />
    <Card>
      <Tabs items={[
        { key: 'stock', label: 'Tồn kho', children: <>
          <Input aria-label="Tìm trong kho hàng" placeholder="Tìm mã, tên sản phẩm" allowClear value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 360, marginBottom: 16 }} />
          {products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : <Table key={search} rowKey="id" loading={products.isPending} dataSource={visible} pagination={tablePagination} scroll={{ x: 900 }} locale={{ emptyText: 'Không có sản phẩm phù hợp.' }} columns={[
            { title: 'Mã sản phẩm', dataIndex: 'sku' }, { title: 'Sản phẩm', dataIndex: 'name' }, { title: 'Đơn vị', dataIndex: 'unit' },
            { title: 'Tồn thực tế', key: 'onHand', render: unknown }, { title: 'Đã giữ', key: 'reserved', render: unknown }, { title: 'Khả dụng', key: 'available', render: unknown },
          ]} />}
        </> },
        { key: 'lots', label: 'Lô hàng', children: <>
          <Space wrap style={{ marginBottom: 16 }}><Input disabled placeholder="Tìm mã lô, sản phẩm" /><Select disabled value="all" options={[{ value: 'all', label: 'Tất cả lô' }, { value: 'expiring', label: 'Sắp hết hạn' }, { value: 'expired', label: 'Đã hết hạn' }]} /></Space>
          <Table rowKey="id" dataSource={[]} pagination={false} scroll={{ x: 750 }} locale={{ emptyText: 'Danh sách lô và cảnh báo hạn sử dụng đang được hoàn thiện.' }} columns={[
            { title: 'Mã lô', key: 'lotCode' }, { title: 'Sản phẩm', key: 'product' }, { title: 'Tồn thực tế', key: 'onHand' }, { title: 'Đã giữ', key: 'reserved' }, { title: 'Khả dụng', key: 'available' }, { title: 'Hạn sử dụng', key: 'expiry' }, { title: 'Cảnh báo', key: 'status' },
          ]} />
        </> },
        { key: 'receipts', label: 'Phiếu nhập', children: <Table rowKey="id" dataSource={[]} pagination={false} scroll={{ x: 750 }} locale={{ emptyText: 'Danh sách phiếu nhập đang được hoàn thiện. Thông tin nhập ở form chưa được lưu.' }} columns={[
          { title: 'Mã phiếu', key: 'code' }, { title: 'Nhà cung cấp', key: 'supplier' }, { title: 'Ngày nhận', key: 'date' }, { title: 'Số dòng', key: 'lines' }, { title: 'Giá trị nhập', key: 'total' }, { title: 'Trạng thái', key: 'status' },
        ]} /> },
      ]} />
    </Card>
    {receiving && <LiveReceiptModal onClose={() => setReceiving(false)} />}
  </Page>
}
