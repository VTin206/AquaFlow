import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Skeleton, Table, Tag } from 'antd'
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'
import { useStaff } from '@/features/auth/useStaff'
import { bottleLedgerApi, type BottleBalance } from '@/features/live/bottleLedgerApi'
import { LiveBottleTypes } from '@/features/live/LiveBottleTypes'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { serverTablePagination } from '@/shared/utils/table'
import { LiveBottleLedger } from './LiveBottleLedger'

export function LiveBottleOverview() {
  const staff = useStaff()
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState<BottleBalance>()
  const [types, setTypes] = useState(false)
  // Tìm ở BE: chờ ngừng gõ rồi mới gửi; đổi từ khóa thì về trang đầu.
  const q = useDebouncedValue(search)
  const [paging, setPaging] = useState({ q, page: 0, size: 8 })
  const page = paging.q === q ? paging.page : 0
  const filters = { page, size: paging.size, q }
  const query = useQuery({
    queryKey: ['live', 'bottle-balances', staff?.name, staff?.role, filters],
    queryFn: () => bottleLedgerApi.balances(filters),
    placeholderData: keepPreviousData,
  })
  return (
    <Card title="Quản lý vỏ bình / tiền cọc" extra={<Button onClick={() => setTypes(true)}>Danh mục loại vỏ</Button>}>
      <p>Sổ theo khách hàng, bao gồm hồ sơ đã lưu trữ. Chọn khách để ghi nhận giao/thu vỏ, thu/hoàn cọc và xem lịch sử.</p>
      <Input
        placeholder="Tìm khách theo tên hoặc số điện thoại"
        aria-label="Tìm khách trong sổ vỏ"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : query.isPending ? (
        <Skeleton active />
      ) : (
        <Table
          rowKey="customerId"
          loading={query.isFetching && query.isPlaceholderData}
          dataSource={query.data.items}
          pagination={serverTablePagination({
            page,
            size: paging.size,
            total: query.data.total,
            onChange: (next, size) => setPaging({ q, page: next, size }),
          })}
          scroll={{ x: 760 }}
          locale={{ emptyText: 'Chưa có khách hàng phù hợp.' }}
          columns={[
            {
              title: 'Khách hàng',
              render: (_, c) => (
                <>
                  <Button type="link" onClick={() => setCustomer(c)}>
                    {c.name}
                  </Button>
                  {!c.active && <Tag>Đã lưu trữ</Tag>}
                </>
              ),
            },
            { title: 'Vỏ đang giữ', dataIndex: 'bottlesHeld', align: 'right' },
            { title: 'Cọc đang giữ', dataIndex: 'depositHeld', render: currency, align: 'right' },
            { title: 'Có thể hoàn', dataIndex: 'refundable', render: currency, align: 'right' },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 112,
              align: 'center',
              render: (_, c) => <ViewButton title="Xem sổ vỏ" subject={c.name} onClick={() => setCustomer(c)} />,
            },
          ]}
        />
      )}
      {customer && (
        <Modal
          open
          centered
          title={`Vỏ & cọc · ${customer.name}`}
          width={modalWidth.large}
          footer={null}
          onCancel={() => setCustomer(undefined)}
        >
          <LiveBottleLedger customerId={customer.customerId} />
        </Modal>
      )}
      {types && <LiveBottleTypes onClose={() => setTypes(false)} />}
    </Card>
  )
}
