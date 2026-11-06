import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Collapse, Modal, Skeleton, Table, Tag } from 'antd'
import { useStaff } from '@/features/auth/useStaff'
import { paymentApi, type CustomerBalance } from '@/features/live/paymentApi'
import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'

export function LiveReceivables() {
  const staff = useStaff()
  const [customer, setCustomer] = useState<CustomerBalance>()
  const [orderId, setOrderId] = useState<number>()
  const allowed = staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF'
  const customers = useQuery({ queryKey: ['live', 'customer-balances', staff?.name, staff?.role], queryFn: paymentApi.customers, enabled: allowed, refetchInterval: 30000 })
  const orders = useQuery({ queryKey: ['live', 'receivables', staff?.name, staff?.role, customer?.customerId], queryFn: () => paymentApi.receivables(customer!.customerId), enabled: allowed && !!customer })
  return <>
    <Collapse style={{ marginBottom: 16 }} items={[{ key: 'debt', label: 'Công nợ và tiền cần hoàn (gồm khách đã lưu trữ)', children: customers.isPending ? <Skeleton active /> : customers.isError ? <QueryError error={customers.error} onRetry={customers.refetch} /> : (
      <Table rowKey="customerId" size="small" dataSource={customers.data.filter(item => item.due > 0 || item.refundDue > 0)} pagination={{ pageSize: 8 }} scroll={{ x: 500 }} locale={{ emptyText: 'Không còn khoản phải thu hoặc tiền cần hoàn.' }} columns={[
        { title: 'Khách hàng', render: (_, item) => <><Button type="link" onClick={() => setCustomer(item)}>{item.name}</Button>{!item.active && <Tag>Đã lưu trữ</Tag>}</> },
        { title: 'Còn phải thu', dataIndex: 'due', align: 'right', render: currency },
        { title: 'Cần hoàn khách', dataIndex: 'refundDue', align: 'right', render: currency },
      ]} />
    ) }]} />
    <Modal open={!!customer} title={`Công nợ — ${customer?.name ?? ''}`} footer={null} onCancel={() => setCustomer(undefined)} width={760}>
      <p>Số còn phải thu tính trên đơn đã xác nhận, không gồm đơn chờ xác nhận hoặc đã hủy. Mở đơn để ghi nhận thu hoặc hoàn tiền.</p>
      {orders.isPending ? <Skeleton active /> : orders.isError ? <QueryError error={orders.error} onRetry={orders.refetch} /> : <Table rowKey="orderId" size="small" dataSource={orders.data} scroll={{ x: 450 }} columns={[
        { title: 'Đơn hàng', render: (_, item) => <Button type="link" onClick={() => setOrderId(item.orderId)}>{item.orderCode}</Button> },
        { title: 'Đã thu ròng', dataIndex: 'paid', render: currency, align: 'right' },
        { title: 'Còn phải thu', dataIndex: 'due', render: currency, align: 'right' },
        { title: 'Cần hoàn', dataIndex: 'refundDue', render: currency, align: 'right' },
      ]} />}
    </Modal>
    {orderId !== undefined && <LiveOrderDetails id={orderId} onClose={() => setOrderId(undefined)} />}
  </>
}
