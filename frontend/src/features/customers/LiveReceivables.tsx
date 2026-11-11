import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Collapse, Input, Modal, Skeleton, Table, Tag } from 'antd'
import { useStaff } from '@/features/auth/useStaff'
import { paymentApi, type CustomerBalance } from '@/features/live/paymentApi'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { useIsDemo } from '@/shared/features'
import { demoReceivablesApi } from './demoReceivables'
import { QueryError } from '@/shared/components/QueryError'
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'
import { currency } from '@/shared/utils/format'
import { pageLocally, type Page } from '@/shared/api/page'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { serverTablePagination } from '@/shared/utils/table'

type CustomerRow = Omit<CustomerBalance, 'customerId'> & { customerId: number | string }
type OrderRow = { orderId: number | string; orderCode: string; paid: number; due: number; refundDue: number }

export function LiveReceivables() {
  const demo = useIsDemo()
  const staff = useStaff()
  const [customer, setCustomer] = useState<CustomerRow>()
  const [orderId, setOrderId] = useState<number | string>()
  const allowed = staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF'
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search)
  // Đổi từ khóa thì về trang đầu.
  const [paging, setPaging] = useState({ q, page: 0, size: 8 })
  const page = paging.q === q ? paging.page : 0
  const query = { page, size: paging.size, q }
  const customers = useQuery({
    queryKey: ['live', 'customer-balances', demo, staff?.name, staff?.role, query],
    queryFn: async (): Promise<Page<CustomerRow>> =>
      demo
        ? pageLocally(
            (await demoReceivablesApi.customers()).filter((item) => item.due > 0 || item.refundDue > 0),
            query,
            (item) => item.name,
          )
        : paymentApi.customers(query),
    enabled: allowed,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })
  const orders = useQuery({
    queryKey: ['live', 'receivables', demo, staff?.name, staff?.role, customer?.customerId],
    queryFn: (): Promise<OrderRow[]> =>
      demo ? demoReceivablesApi.receivables(String(customer!.customerId)) : paymentApi.receivables(Number(customer!.customerId)),
    enabled: allowed && !!customer,
  })
  return (
    <>
      <Collapse
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'debt',
            label: 'Công nợ và tiền cần hoàn (gồm khách đã lưu trữ)',
            children: customers.isPending ? (
              <Skeleton active />
            ) : customers.isError ? (
              <QueryError error={customers.error} onRetry={customers.refetch} />
            ) : (
              <>
                <Input
                  placeholder="Tìm khách theo tên hoặc số điện thoại"
                  aria-label="Tìm khách còn công nợ"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  allowClear
                  style={{ marginBottom: 12 }}
                />
                <Table
                  rowKey="customerId"
                  size="small"
                  loading={customers.isFetching && customers.isPlaceholderData}
                  dataSource={customers.data.items}
                  pagination={serverTablePagination({
                    page,
                    size: paging.size,
                    total: customers.data.total,
                    onChange: (next, size) => setPaging({ q, page: next, size }),
                  })}
                  scroll={{ x: 500 }}
                  locale={{ emptyText: q.trim() ? 'Không tìm thấy khách phù hợp.' : 'Không còn khoản phải thu hoặc tiền cần hoàn.' }}
                  columns={[
                    {
                      title: 'Khách hàng',
                      render: (_, item) => (
                        <>
                          <Button type="link" onClick={() => setCustomer(item)}>
                            {item.name}
                          </Button>
                          {!item.active && <Tag>Đã lưu trữ</Tag>}
                        </>
                      ),
                    },
                    { title: 'Còn phải thu', dataIndex: 'due', align: 'right', render: currency },
                    { title: 'Cần hoàn khách', dataIndex: 'refundDue', align: 'right', render: currency },
                    {
                      title: 'Thao tác',
                      key: 'actions',
                      width: 112,
                      align: 'center' as const,
                      render: (_, item) => <ViewButton title="Xem công nợ" subject={item.name} onClick={() => setCustomer(item)} />,
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
      <Modal
        open={!!customer}
        title={`Công nợ — ${customer?.name ?? ''}`}
        footer={null}
        onCancel={() => setCustomer(undefined)}
        width={modalWidth.medium}
        centered
      >
        <p>Số còn phải thu tính trên đơn đã xác nhận, không gồm đơn chờ xác nhận hoặc đã hủy. Mở đơn để ghi nhận thu hoặc hoàn tiền.</p>
        {orders.isPending ? (
          <Skeleton active />
        ) : orders.isError ? (
          <QueryError error={orders.error} onRetry={orders.refetch} />
        ) : (
          <Table
            rowKey="orderId"
            size="small"
            dataSource={orders.data}
            scroll={{ x: 450 }}
            columns={[
              {
                title: 'Đơn hàng',
                render: (_, item) => (
                  <Button type="link" onClick={() => setOrderId(item.orderId)}>
                    {item.orderCode}
                  </Button>
                ),
              },
              { title: 'Đã thu ròng', dataIndex: 'paid', render: currency, align: 'right' },
              { title: 'Còn phải thu', dataIndex: 'due', render: currency, align: 'right' },
              { title: 'Cần hoàn', dataIndex: 'refundDue', render: currency, align: 'right' },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 112,
                align: 'center' as const,
                render: (_, item) => <ViewButton subject={`đơn ${item.orderCode}`} onClick={() => setOrderId(item.orderId)} />,
              },
            ]}
          />
        )}
      </Modal>
      {orderId !== undefined && <OrderDetails id={String(orderId)} onClose={() => setOrderId(undefined)} />}
    </>
  )
}
