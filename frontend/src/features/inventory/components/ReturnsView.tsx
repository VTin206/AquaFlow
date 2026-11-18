import { useState, type ReactNode } from 'react'
import { Button, Empty, Modal, Space, Table, Tabs } from 'antd'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'

export type PendingReturnRow = { key: string | number; orderCode: string; recipient: string | null; reason: string | null; goods: string }
export type ReturnHistoryRow = {
  id: string | number
  orderCode: string
  createdAt: string
  note?: string | null
  lines: { key: string; productName: string; lotCode?: string | null; quantity: number; sellable: number | null }[]
}

type Props = {
  pending: PendingReturnRow[]
  pendingLoading: boolean
  pendingError?: ReactNode
  onInspect: (row: PendingReturnRow) => void
  history: ReturnHistoryRow[]
  historyLoading: boolean
  historyError?: ReactNode
  /** Phân trang phía server; dữ liệu mẫu hiện hết nên không truyền. */
  paging?: { page: number; hasNext: boolean; onChange: (page: number) => void }
  children?: ReactNode
}

/** Hàng hoàn về: đơn chờ kiểm và các phiếu đã kiểm. */
export function ReturnsView({
  pending,
  pendingLoading,
  pendingError,
  onInspect,
  history,
  historyLoading,
  historyError,
  paging,
  children,
}: Props) {
  const [detail, setDetail] = useState<ReturnHistoryRow | null>(null)
  const waiting = pending.length
  return (
    <>
      <Tabs
        className="af-returns-tabs"
        items={[
          {
            key: 'pending',
            label: `Chờ kiểm (${waiting})`,
            children: pendingError ?? (
              <>
                {waiting > 0 && (
                  <OrderFocusBanner
                    focus={{
                      tone: 'action',
                      title: `Có ${waiting} đơn cần kiểm hàng hoàn`,
                      description:
                        'Hàng giao thất bại không tự cộng lại vào kho. Kiểm đủ hàng thì đơn mới giao lại hoặc hủy được. Phiếu hoàn không tự hoàn tiền.',
                    }}
                  />
                )}
                <Table<PendingReturnRow>
                  rowKey="key"
                  loading={pendingLoading}
                  dataSource={pending}
                  pagination={false}
                  scroll={{ x: 760 }}
                  locale={{
                    emptyText: (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn chờ kiểm. Đơn giao thất bại sẽ hiện ở đây." />
                    ),
                  }}
                  columns={[
                    { title: 'Đơn hàng', dataIndex: 'orderCode' },
                    { title: 'Người nhận', dataIndex: 'recipient' },
                    { title: 'Lý do giao thất bại', dataIndex: 'reason', ellipsis: true },
                    { title: 'Hàng mang về', dataIndex: 'goods' },
                    {
                      title: 'Thao tác',
                      width: 130,
                      render: (_, row) => (
                        <Button size="small" type="primary" onClick={() => onInspect(row)}>
                          Kiểm hàng
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'history',
            label: 'Đã kiểm',
            children: historyError ?? (
              <>
                <Table<ReturnHistoryRow>
                  rowKey="id"
                  loading={historyLoading}
                  dataSource={history}
                  pagination={false}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiếu hoàn nào." /> }}
                  columns={[
                    { title: 'Phiếu', dataIndex: 'id' },
                    { title: 'Đơn', dataIndex: 'orderCode' },
                    { title: 'Ngày kiểm', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
                    {
                      title: 'Thao tác',
                      width: 112,
                      align: 'center' as const,
                      render: (_, row) => <ViewButton subject={`phiếu hoàn #${row.id}`} onClick={() => setDetail(row)} />,
                    },
                  ]}
                />
                {paging && (
                  <Space style={{ padding: '12px 24px' }}>
                    <Button disabled={paging.page === 0} onClick={() => paging.onChange(paging.page - 1)}>
                      Trước
                    </Button>
                    Trang {paging.page + 1}
                    <Button disabled={!paging.hasNext} onClick={() => paging.onChange(paging.page + 1)}>
                      Sau
                    </Button>
                  </Space>
                )}
              </>
            ),
          },
        ]}
      />
      <Modal
        open={!!detail}
        centered
        onCancel={() => setDetail(null)}
        footer={null}
        title={`Phiếu hoàn #${detail?.id ?? ''} · ${detail?.orderCode ?? ''}`}
        width={modalWidth.medium}
      >
        <Table
          rowKey="key"
          size="small"
          dataSource={detail?.lines}
          pagination={false}
          scroll={{ x: 600 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'productName' },
            { title: 'Lô', dataIndex: 'lotCode' },
            { title: 'Thực nhận đợt này', dataIndex: 'quantity', align: 'right' },
            { title: 'Nhập kho', dataIndex: 'sellable', align: 'right' },
            { title: 'Loại bỏ', align: 'right', render: (_, row) => row.quantity - (row.sellable ?? 0) },
          ]}
        />
        {detail?.note && <p className="af-form-hint">Ghi chú: {detail.note}</p>}
      </Modal>
      {children}
    </>
  )
}
