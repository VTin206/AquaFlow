import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Descriptions, Empty, Input, Modal, Select, Space, Spin, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { movementApi, movementLabels, type InventoryMovement, type MovementFilter, type MovementType } from '@/features/live/movementApi'
import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
import { QueryError } from '@/shared/components/QueryError'
import { tableScrollHeight } from '@/shared/utils/table'
import { isoToVnDate } from '../expiry'

const timestamp = (value: string) => new Date(value).toLocaleString('vi-VN')
const signed = (row: InventoryMovement) => `${row.signedQuantity > 0 ? '+' : ''}${row.signedQuantity} ${row.unit}`

export function LiveMovementsPanel() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<MovementFilter>({ page: 0, size: 20 })
  const [selected, setSelected] = useState<number | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const query = useQuery({
    queryKey: ['live', 'inventory-movements', user?.email, user?.role, filter],
    queryFn: () => movementApi.list(filter),
    refetchInterval: 15000,
  })
  const detail = useQuery({
    queryKey: ['live', 'inventory-movement', user?.email, user?.role, selected],
    queryFn: () => movementApi.detail(selected!),
    enabled: selected !== null,
  })
  const update = (values: Partial<MovementFilter>) => setFilter((previous) => ({ ...previous, ...values, page: 0 }))
  const row = detail.data
  return (
    <>
      <div className="af-toolbar">
        <Space wrap>
          <Select<MovementType | 'all'>
            aria-label="Loại giao dịch kho"
            value={filter.type ?? 'all'}
            onChange={(type) => update({ type: type === 'all' ? undefined : type })}
            options={[
              { value: 'all', label: 'Tất cả loại giao dịch' },
              ...Object.entries(movementLabels).map(([value, label]) => ({ value, label })),
            ]}
            style={{ minWidth: 200 }}
          />
          <DatePicker.RangePicker
            aria-label="Khoảng ngày xuất nhập"
            format="DD/MM/YYYY"
            onChange={(dates) =>
              update({ from: dates?.[0]?.startOf('day').toISOString(), to: dates?.[1]?.add(1, 'day').startOf('day').toISOString() })
            }
          />
          <Input.Search
            allowClear
            placeholder="Sản phẩm, mã lô, chứng từ, nhân viên"
            maxLength={200}
            onSearch={(q) => update({ q: q.trim() })}
            style={{ width: 300 }}
          />
          <Button onClick={() => void query.refetch()} loading={query.isFetching}>
            Làm mới
          </Button>
          <Link to="/orders">
            <Button>Xuất kho theo đơn</Button>
          </Link>
        </Space>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : (
        <Table<InventoryMovement>
          rowKey="id"
          className="af-data-table af-table-flush"
          loading={query.isPending}
          dataSource={query.data?.content ?? []}
          scroll={{ x: 1100, y: tableScrollHeight }}
          pagination={{
            current: filter.page + 1,
            pageSize: filter.size,
            total: query.data?.totalElements ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => `${total} giao dịch`,
            onChange: (page, size) => setFilter((previous) => ({ ...previous, page: size === previous.size ? page - 1 : 0, size })),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có giao dịch kho phù hợp. Giao dịch được ghi khi xác nhận nhập hoặc xuất kho."
              />
            ),
          }}
          columns={[
            { title: 'Thời điểm', dataIndex: 'occurredAt', width: 170, render: timestamp },
            {
              title: 'Loại',
              dataIndex: 'type',
              width: 175,
              render: (type: MovementType, item) => <Tag color={item.signedQuantity < 0 ? 'blue' : 'green'}>{movementLabels[type]}</Tag>,
            },
            {
              title: 'Sản phẩm',
              dataIndex: 'productName',
              render: (_, item) => (
                <div className="af-cell-stack">
                  <span>{item.productName}</span>
                  <small>{item.sku}</small>
                </div>
              ),
            },
            {
              title: 'Lô / hạn dùng',
              key: 'lot',
              width: 150,
              render: (_, item) => (
                <div className="af-cell-stack">
                  <span>{item.lotCode}</span>
                  <small>{isoToVnDate(item.expiresOn)}</small>
                </div>
              ),
            },
            {
              title: 'Số lượng',
              key: 'quantity',
              align: 'right',
              width: 120,
              render: (_, item) => <span className={item.signedQuantity < 0 ? 'af-text-danger' : undefined}>{signed(item)}</span>,
            },
            {
              title: 'Chứng từ',
              dataIndex: 'referenceCode',
              width: 170,
              render: (code: string, item) => (
                <Button type="link" onClick={() => setSelected(item.id)}>
                  {code}
                </Button>
              ),
            },
            { title: 'Người thực hiện', dataIndex: 'performedByName', width: 160 },
          ]}
        />
      )}
      <Modal
        open={selected !== null}
        title={`Giao dịch kho #${selected ?? ''}`}
        onCancel={() => setSelected(null)}
        footer={
          <Space>
            {row?.referenceType === 'ORDER' && (
              <Button
                onClick={() => {
                  setOrderId(row.referenceId)
                  setSelected(null)
                }}
              >
                Xem đơn hàng
              </Button>
            )}
            <Button onClick={() => setSelected(null)}>Đóng</Button>
          </Space>
        }
      >
        {detail.isError ? (
          <QueryError error={detail.error} onRetry={detail.refetch} />
        ) : detail.isPending ? (
          <Spin />
        ) : (
          row && (
            <Descriptions
              column={1}
              items={[
                { key: 'type', label: 'Loại', children: movementLabels[row.type] },
                { key: 'at', label: 'Thời điểm', children: timestamp(row.occurredAt) },
                { key: 'product', label: 'Sản phẩm', children: `${row.productName} (${row.sku})` },
                { key: 'lot', label: 'Lô', children: row.lotCode },
                { key: 'expiry', label: 'Hạn dùng', children: isoToVnDate(row.expiresOn) },
                { key: 'quantity', label: 'Biến động', children: signed(row) },
                { key: 'reference', label: 'Chứng từ', children: row.referenceCode },
                { key: 'actor', label: 'Người thực hiện', children: row.performedByName },
                { key: 'reason', label: 'Ghi chú', children: row.reason || '—' },
              ]}
            />
          )
        )}
      </Modal>
      {orderId !== null && <LiveOrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
