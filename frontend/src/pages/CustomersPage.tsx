import { ArrowUpRight, Boxes, Ellipsis, Filter, MapPin, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { SearchField } from '../components/SearchField'
import { EmptyState, QueryFallback } from '../components/StateViews'
import { useCustomers } from '../hooks/useCustomers'

export function CustomersPage() {
  const customersQuery = useCustomers()
  const [query, setQuery] = useState('')

  if (customersQuery.isPending || customersQuery.isError) return <QueryFallback query={customersQuery} />

  const customers = customersQuery.data
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.area}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="page-content subpage-content">
      <div className="customer-summary">
        <div className="summary-tile">
          <span>Tổng khách hàng</span>
          <strong>248</strong>
          <small>
            <Users size={13} /> hồ sơ khách hàng
          </small>
        </div>
        <div className="summary-tile">
          <span>Khách hàng mới</span>
          <strong>18</strong>
          <small>
            <ArrowUpRight size={13} /> trong tháng này
          </small>
        </div>
        <div className="summary-tile">
          <span>Vỏ bình đang lưu</span>
          <strong>136</strong>
          <small>
            <Boxes size={13} /> từ khách hàng
          </small>
        </div>
      </div>

      <div className="surface data-surface">
        <div className="toolbar">
          <div className="toolbar-copy">
            <strong>Danh sách khách hàng</strong>
            <span>Thông tin mua hàng và đối soát vỏ bình</span>
          </div>
          <div className="toolbar-controls">
            <SearchField value={query} onChange={setQuery} placeholder="Tìm tên, số điện thoại..." />
            <button className="button button-secondary filter-button">
              <Filter size={15} /> Bộ lọc
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>KHÁCH HÀNG</th>
                <th>KHU VỰC</th>
                <th>ĐƠN HÀNG</th>
                <th>VỎ ĐANG GIỮ</th>
                <th>LIÊN HỆ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => (
                <tr key={customer.phone}>
                  <td>
                    <div className="customer-cell">
                      <span className="customer-avatar">{customer.initials}</span>
                      <span>
                        <strong>{customer.name}</strong>
                        <small>Khách hàng thân thiết</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="location-cell">
                      <MapPin size={13} />
                      {customer.area}
                    </span>
                  </td>
                  <td>
                    <strong>{customer.orders}</strong> đơn
                  </td>
                  <td>
                    <span className="bottle-balance">
                      <Boxes size={14} />
                      {customer.balance}
                    </span>
                  </td>
                  <td>{customer.phone}</td>
                  <td>
                    <button className="row-menu" aria-label={`Tùy chọn ${customer.name}`}>
                      <Ellipsis size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <EmptyState icon={Search} title="Không tìm thấy khách hàng" description="Thử tìm theo tên, số điện thoại hoặc khu vực." />}
        </div>
      </div>
    </div>
  )
}
