import { useState } from 'react'
import { Unsupported } from '@/shared/components/Unsupported'
import { App, Button, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { Pencil } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { tablePagination } from '@/shared/utils/table'
import { isoToVnDate } from '../expiry'
import {
  useInventoryCaps,
  useReceiptAction,
  useReceiptViews,
  type ReceiptLineView,
  type ReceiptStatus,
  type ReceiptView,
} from '../useInventory'
import { ReceiptResult } from './ReceiveStockModal'
import { modalWidth } from '@/shared/utils/modal'

type ReceiptFilter = 'all' | ReceiptStatus

const statusTags: Record<ReceiptStatus, { color: string; label: string }> = {
  DRAFT: { color: 'blue', label: 'Nháp' },
  CONFIRMED: { color: 'green', label: 'Đã nhập kho' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
}

/** Danh sách phiếu nhập; mở rộng một dòng để xem từng lô đã kiểm nhận. Phiếu nháp được sửa, nhập kho hoặc hủy tại đây. */
export function ReceiptsPanel({ onEdit }: { onEdit: (receipt: ReceiptView) => void }) {
  const { message } = App.useApp()
  const caps = useInventoryCaps()
  const receiptsQuery = useReceiptViews()
  const action = useReceiptAction()
  const [filter, setFilter] = useState<ReceiptFilter>('all')
  const [result, setResult] = useState<ReceiptView>()
  if (receiptsQuery.isError) return <QueryError error={receiptsQuery.error} onRetry={receiptsQuery.refetch} />

  const receipts = receiptsQuery.data ?? []
  const count = (status: ReceiptStatus) => receipts.filter((receipt) => receipt.status === status).length
  const visible = filter === 'all' ? receipts : receipts.filter((receipt) => receipt.status === filter)
  const run = (receipt: ReceiptView, kind: 'confirm' | 'cancel') =>
    action.mutate(
      { id: receipt.id, action: kind },
      {
        onSuccess: (updated) => (kind === 'confirm' ? setResult(updated) : message.success(`Đã hủy phiếu ${updated.code}.`)),
        onError: (error) => message.error(error.message),
      },
    )

  return (
    <>
      <div className="af-toolbar">
        <Segmented<ReceiptFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: <CountLabel label="Tất cả" count={receipts.length} /> },
            { value: 'DRAFT', label: <CountLabel label="Nháp" count={count('DRAFT')} urgent tone="warning" /> },
            { value: 'CONFIRMED', label: <CountLabel label="Đã nhập kho" count={count('CONFIRMED')} tone="success" /> },
            { value: 'CANCELLED', label: <CountLabel label="Đã hủy" count={count('CANCELLED')} tone="danger" /> },
          ]}
        />
      </div>
      <Table<ReceiptView>
        key={filter}
        className="af-data-table af-table-flush"
        size="middle"
        rowKey="id"
        loading={receiptsQuery.isPending}
        dataSource={visible}
        pagination={tablePagination}
        scroll={{ x: 1170 }}
        locale={{ emptyText: receipts.length ? 'Không có phiếu phù hợp.' : 'Chưa có phiếu nhập.' }}
        expandable={{
          expandedRowRender: (receipt) => (
            <>
              <Table<ReceiptLineView>
                rowKey={(line) => `${line.productId}-${line.lotCode}`}
                size="small"
                pagination={false}
                dataSource={receipt.lines}
                columns={[
                  { title: 'Sản phẩm', dataIndex: 'productName', ellipsis: true },
                  { title: 'Mã lô', dataIndex: 'lotCode', width: 140, render: (code?: string) => code ?? '—' },
                  { title: 'Hạn dùng', dataIndex: 'expiryDate', width: 110, render: (date?: string) => (date ? isoToVnDate(date) : '—') },
                  { title: 'Thực nhận', dataIndex: 'received', width: 95, align: 'right' },
                  {
                    title: 'Hỏng',
                    dataIndex: 'damaged',
                    width: 70,
                    align: 'right',
                    render: (damaged: number) => (damaged ? <Typography.Text type="danger">{damaged}</Typography.Text> : 0),
                  },
                  { title: 'Giá vốn', dataIndex: 'costPrice', width: 110, align: 'right', render: currency },
                ]}
              />
              {receipt.note && <p className="af-form-hint af-receipt-note">Ghi chú: {receipt.note}</p>}
            </>
          ),
        }}
        columns={[
          { title: 'Phiếu', dataIndex: 'code', width: 105, render: (code: string) => <strong>{code}</strong> },
          { title: 'Ngày nhận', dataIndex: 'receivedAt', width: 115, render: isoToVnDate },
          { title: 'Nhà cung cấp', dataIndex: 'supplierName', ellipsis: true },
          { title: 'Số dòng', key: 'lines', width: 80, align: 'right', render: (_, receipt) => receipt.lines.length },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 125,
            render: (status: ReceiptStatus) => <Tag color={statusTags[status].color}>{statusTags[status].label}</Tag>,
          },
          {
            title: 'Kiểm nhận',
            key: 'check',
            width: 115,
            render: (_, receipt) => {
              const damaged = receipt.lines.reduce((sum, line) => sum + line.damaged, 0)
              return damaged ? (
                <Tag color="orange">{damaged} hỏng</Tag>
              ) : receipt.note ? (
                <Tag color="gold">Có ghi chú</Tag>
              ) : (
                <Tag color="green">Đạt</Tag>
              )
            },
          },
          {
            title: 'Giá trị nhập',
            dataIndex: 'total',
            width: 145,
            align: 'right',
            render: (total: number) => <span className="af-money">{currency(total)}</span>,
          },
          {
            title: 'Người nhận',
            dataIndex: 'receiver',
            width: 105,
            render: (receiver?: string) => (caps.receiver ? receiver : <Unsupported />),
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 200,
            render: (_: unknown, receipt: ReceiptView) =>
              receipt.status === 'DRAFT' && (
                <Space size={4} wrap>
                  <Popconfirm
                    title={`Nhập kho phiếu ${receipt.code}?`}
                    description="Hàng đạt được cộng vào tồn; sau đó không sửa hoặc hủy phiếu được."
                    okText="Nhập kho"
                    cancelText="Chưa"
                    onConfirm={() => run(receipt, 'confirm')}
                  >
                    <Button
                      size="small"
                      type="primary"
                      loading={action.isPending && action.variables?.id === receipt.id && action.variables.action === 'confirm'}
                      disabled={action.isPending}
                    >
                      Nhập kho
                    </Button>
                  </Popconfirm>
                  <Tooltip title="Sửa phiếu">
                    <Button
                      size="small"
                      icon={<Pencil size={15} />}
                      aria-label={`Sửa phiếu ${receipt.code}`}
                      disabled={action.isPending}
                      onClick={() => onEdit(receipt)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title={`Hủy phiếu ${receipt.code}?`}
                    description="Phiếu đã hủy không dùng lại được."
                    okText="Hủy phiếu"
                    okButtonProps={{ danger: true }}
                    cancelText="Không"
                    onConfirm={() => run(receipt, 'cancel')}
                  >
                    <Button
                      size="small"
                      danger
                      type="text"
                      loading={action.isPending && action.variables?.id === receipt.id && action.variables.action === 'cancel'}
                      disabled={action.isPending}
                    >
                      Hủy
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />
      <Modal
        open={result !== undefined}
        title="Kết quả nhập kho"
        width={modalWidth.medium}
        footer={null}
        onCancel={() => setResult(undefined)}
        destroyOnHidden
      >
        {result && <ReceiptResult receipt={result} onClose={() => setResult(undefined)} />}
      </Modal>
    </>
  )
}
