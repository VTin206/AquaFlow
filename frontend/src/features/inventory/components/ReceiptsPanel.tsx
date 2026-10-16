import { Table, Tag, Typography } from 'antd'
import { QueryError } from '../../../shared/components/QueryError'
import { currency } from '../../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../../shared/utils/table'
import { isoToVnDate } from '../expiry'
import type { Receipt } from '../types'
import { useReceipts } from '../useProducts'

type ReceiptRow = Receipt['lines'][number]

/** Danh sách phiếu nhập; mở rộng một dòng để xem từng lô đã kiểm nhận. */
export function ReceiptsPanel() {
  const receiptsQuery = useReceipts()
  if (receiptsQuery.isError) return <QueryError error={receiptsQuery.error} onRetry={receiptsQuery.refetch} />

  return (
    <Table<Receipt>
      className="af-data-table"
      size="middle"
      rowKey="id"
      loading={receiptsQuery.isPending}
      dataSource={receiptsQuery.data}
      pagination={tablePagination}
      scroll={{ x: 880, y: tableScrollHeight }}
      locale={{ emptyText: 'Chưa có phiếu nhập.' }}
      expandable={{
        expandedRowRender: (receipt) => (
          <>
            <Table<ReceiptRow>
              rowKey={(line) => `${line.productId}-${line.lotCode}`}
              size="small"
              pagination={false}
              dataSource={receipt.lines}
              columns={[
                { title: 'Sản phẩm', dataIndex: 'productName', ellipsis: true },
                { title: 'Mã lô', dataIndex: 'lotCode', width: 140, render: (code?: string) => code ?? '—' },
                { title: 'Hạn dùng', dataIndex: 'expiryDate', width: 110, render: (date?: string) => (date ? isoToVnDate(date) : '—') },
                { title: 'Thực nhận', dataIndex: 'received', width: 95, align: 'right' },
                { title: 'Hỏng', dataIndex: 'damaged', width: 70, align: 'right', render: (damaged: number) => (damaged ? <Typography.Text type="danger">{damaged}</Typography.Text> : 0) },
                { title: 'Giá vốn', dataIndex: 'costPrice', width: 110, align: 'right', render: currency },
              ]}
            />
            {receipt.note && <p className="af-form-hint af-receipt-note">Ghi chú: {receipt.note}</p>}
          </>
        ),
      }}
      columns={[
        { title: 'Phiếu', dataIndex: 'id', width: 110, render: (id: string) => <strong>{id}</strong> },
        { title: 'Ngày nhận', dataIndex: 'receivedAt', width: 120, render: isoToVnDate },
        { title: 'Nhà cung cấp', dataIndex: 'supplierName', ellipsis: true },
        { title: 'Số dòng', key: 'lines', width: 90, align: 'right', render: (_, receipt) => receipt.lines.length },
        {
          title: 'Kiểm nhận',
          key: 'check',
          width: 150,
          render: (_, receipt) => {
            const damaged = receipt.lines.reduce((sum, line) => sum + line.damaged, 0)
            return damaged ? <Tag color="orange">{damaged} hỏng</Tag> : receipt.note ? <Tag color="gold">Có ghi chú</Tag> : <Tag color="green">Đạt</Tag>
          },
        },
        { title: 'Giá trị nhập', dataIndex: 'total', width: 140, align: 'right', render: (total: number) => <span className="af-money">{currency(total)}</span> },
        { title: 'Người nhận', dataIndex: 'receiver', width: 130 },
      ]}
    />
  )
}
