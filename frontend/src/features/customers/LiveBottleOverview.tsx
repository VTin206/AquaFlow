import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Skeleton, Table, Tag } from 'antd'
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'
import { useStaff } from '@/features/auth/useStaff'
import { bottleLedgerApi, type BottleBalance } from '@/features/live/bottleLedgerApi'
import { LiveBottleTypes } from '@/features/live/LiveBottleTypes'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { matchesSearch } from '@/shared/utils/search'
import { useIsDemo } from '@/shared/features'
import { demoBottleApi } from './demoBottleLedger'
import { LiveBottleLedger } from './LiveBottleLedger'

type BalanceRow = Omit<BottleBalance, 'customerId'> & { customerId: number | string }

export function LiveBottleOverview() {
  const staff = useStaff()
  const demo = useIsDemo()
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState<BalanceRow>()
  const [types, setTypes] = useState(false)
  const query = useQuery({
    queryKey: ['live', 'bottle-balances', demo, staff?.name, staff?.role],
    queryFn: (): Promise<BalanceRow[]> => (demo ? demoBottleApi.balances() : bottleLedgerApi.balances()),
  })
  return (
    <Card title="Quản lý vỏ bình / tiền cọc" extra={<Button onClick={() => setTypes(true)}>Danh mục loại vỏ</Button>}>
      <p>Sổ theo khách hàng, bao gồm hồ sơ đã lưu trữ. Chọn khách để ghi nhận giao/thu vỏ, thu/hoàn cọc và xem lịch sử.</p>
      <Input
        placeholder="Tìm khách trong sổ vỏ"
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
          dataSource={query.data.filter((c) => matchesSearch(search, c.name))}
          pagination={{ pageSize: 8 }}
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
