import { Table, Tag, Tooltip, type TableColumnsType } from 'antd'
import { currency, shortDate } from '@/shared/utils/format'
import type { SlowMover } from './productSales'

const statusTags: Record<SlowMover['status'], { label: string; color: string; hint: (row: SlowMover) => string }> = {
  unsold: {
    label: 'Không bán được',
    color: 'red',
    hint: () => 'Còn hàng mà cả kỳ không bán: cân nhắc giảm nhập, khuyến mãi hoặc ngừng bán.',
  },
  outOfStock: {
    label: 'Hết hàng',
    color: 'orange',
    hint: () => 'Bán ít có thể do hết hàng, không phải do ít khách mua: kiểm tra trước khi giảm nhập.',
  },
  slow: {
    label: 'Bán chậm',
    color: 'gold',
    hint: (row) =>
      row.onHand >= row.quantity * 2
        ? `Tồn gấp ${Math.floor(row.onHand / row.quantity)} lần số bán trong kỳ: nên giảm lượng nhập.`
        : 'Bán ít so với các sản phẩm khác, tồn vẫn vừa phải.',
  },
}

const columns: TableColumnsType<SlowMover> = [
  { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true },
  {
    title: 'Bán trong kỳ',
    dataIndex: 'quantity',
    align: 'right',
    width: 120,
    render: (_, row) => `${row.quantity.toLocaleString('vi-VN')} ${row.unit.toLowerCase()}`,
  },
  {
    title: 'Doanh thu',
    dataIndex: 'revenue',
    align: 'right',
    width: 130,
    render: (value: number) => currency(value),
  },
  {
    title: 'Tồn kho',
    dataIndex: 'onHand',
    align: 'right',
    width: 100,
    render: (value: number) => value.toLocaleString('vi-VN'),
  },
  {
    title: 'Hạn gần nhất',
    dataIndex: 'nearestExpiry',
    align: 'right',
    width: 120,
    render: (value?: string) => (value ? shortDate(value) : '—'),
  },
  {
    title: 'Gợi ý',
    key: 'status',
    width: 150,
    // Câu gợi ý nằm trong tooltip của thẻ để mỗi sản phẩm chỉ một dòng.
    render: (_, row) => {
      const tag = statusTags[row.status]
      return (
        <Tooltip title={tag.hint(row)}>
          <Tag color={tag.color} style={{ margin: 0 }}>
            {tag.label}
          </Tag>
        </Tooltip>
      )
    },
  },
]

/** Sản phẩm đang bán có số bán thấp nhất trong kỳ, kèm tồn kho và gợi ý điều chỉnh. */
export function SlowMovers({ rows }: { rows: SlowMover[] }) {
  return (
    <Table<SlowMover>
      size="small"
      rowKey="productId"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 620 }}
      locale={{ emptyText: 'Chưa có sản phẩm đang bán.' }}
    />
  )
}
