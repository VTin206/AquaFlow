import { useState } from 'react'
import { App, Avatar, Button, Card, Col, Input, Row, Statistic, Table, Tag, type TableColumnsType } from 'antd'
import { Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CreateOrderModal } from '../orders/components/CreateOrderModal'
import type { Customer } from './types'
import { useCustomers } from './useCustomers'

export function CustomersPage() {
  const { message } = App.useApp()
  const customersQuery = useCustomers()
  const [query, setQuery] = useState('')
  const [orderFor, setOrderFor] = useState<string | null>(null)

  const customers = customersQuery.data ?? []
  const keyword = query.trim().toLowerCase()
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.area}`.toLowerCase().includes(keyword))
  const totalBottles = customers.reduce((sum, customer) => sum + customer.bottlesHeld, 0)

  const columns: TableColumnsType<Customer> = [
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, customer) => (
        <div className="af-customer-cell">
          <Avatar className="af-avatar">{customer.initials}</Avatar>
          <div className="af-cell-stack">
            <span>{customer.name}</span>
            <small>
              <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
            </small>
          </div>
        </div>
      ),
    },
    { title: 'Khu vực', dataIndex: 'area' },
    { title: 'Số đơn đã mua', dataIndex: 'orders', align: 'right', width: 140, sorter: (a, b) => a.orders - b.orders, defaultSortOrder: 'descend' },
    {
      title: 'Vỏ đang giữ',
      dataIndex: 'bottlesHeld',
      width: 140,
      sorter: (a, b) => a.bottlesHeld - b.bottlesHeld,
      render: (count: number) => (count > 0 ? <Tag color="orange">{count} vỏ</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, customer) => (
        <Button size="small" onClick={() => setOrderFor(customer.name)}>
          Tạo đơn
        </Button>
      ),
    },
  ]

  return (
    <Page
      title="Khách hàng"
      description="Thông tin liên hệ, lịch sử mua và số vỏ bình đang giữ."
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => message.info('Biểu mẫu thêm khách hàng sẽ được bổ sung ở bước tiếp theo.')}>
          Thêm khách hàng
        </Button>
      }
    >
      {customersQuery.isError ? (
        <Card>
          <QueryError error={customersQuery.error} onRetry={customersQuery.refetch} />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} className="af-stat-row">
            <Col xs={12} lg={8}>
              <Card loading={customersQuery.isPending}>
                <Statistic title="Khách hàng" value={customers.length} />
              </Card>
            </Col>
            <Col xs={12} lg={8}>
              <Card loading={customersQuery.isPending}>
                <Statistic title="Vỏ bình khách đang giữ" value={totalBottles} suffix="vỏ" />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card loading={customersQuery.isPending}>
                <Statistic title="Khách đang giữ vỏ" value={customers.filter((customer) => customer.bottlesHeld > 0).length} />
              </Card>
            </Col>
          </Row>
          <Card className="af-card" styles={{ body: { padding: 0 } }}>
            <div className="af-toolbar">
              <span className="af-toolbar-title">Danh sách khách hàng</span>
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm tên, số điện thoại, khu vực..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            <Table<Customer>
              rowKey="phone"
              columns={columns}
              dataSource={visible}
              loading={customersQuery.isPending}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              locale={{ emptyText: keyword ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.' }}
              scroll={{ x: 760 }}
            />
          </Card>
        </>
      )}
      <CreateOrderModal open={orderFor !== null} defaultCustomer={orderFor ?? undefined} onClose={() => setOrderFor(null)} />
    </Page>
  )
}
