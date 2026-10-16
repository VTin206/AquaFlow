import { Activity, Boxes, CircleDollarSign, Clock3, Droplets, Filter, Plus, Search } from 'lucide-react'
import { SearchField } from '../components/SearchField'
import { EmptyState } from '../components/StateViews'
import type { Product } from '../types'
import { currency } from '../utils/format'

type InventoryPageProps = { products: Product[]; query: string; setQuery: (value: string) => void; onReceiveStock: () => void }

export function InventoryPage({ products, query, setQuery, onReceiveStock }: InventoryPageProps) {
  const visible = products.filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query.toLowerCase()))
  const lowCount = products.filter((item) => item.stock <= item.threshold).length
  const stockValue = products.reduce((sum, item) => sum + item.stock * item.price, 0)

  return (
    <div className="page-content subpage-content">
      <div className="inventory-summary">
        <div className="summary-tile">
          <span>Tổng mã hàng</span>
          <strong>{products.length.toString().padStart(2, '0')}</strong>
          <small>
            <Boxes size={13} /> đang kinh doanh
          </small>
        </div>
        <div className="summary-tile">
          <span>Tồn kho thấp</span>
          <strong className="text-coral">{lowCount.toString().padStart(2, '0')}</strong>
          <small>
            <Activity size={13} /> cần nhập thêm
          </small>
        </div>
        <div className="summary-tile">
          <span>Lô sắp hết hạn</span>
          <strong className="text-amber">03</strong>
          <small>
            <Clock3 size={13} /> trong 30 ngày tới
          </small>
        </div>
        <div className="summary-tile">
          <span>Giá trị tồn kho</span>
          <strong>{currency(stockValue)}</strong>
          <small>
            <CircleDollarSign size={13} /> theo giá nhập
          </small>
        </div>
      </div>

      <div className="surface data-surface">
        <div className="toolbar">
          <div className="toolbar-copy">
            <strong>Danh sách tồn kho</strong>
            <span>Theo dõi số lượng và hạn sử dụng theo lô</span>
          </div>
          <div className="toolbar-controls">
            <SearchField value={query} onChange={setQuery} placeholder="Tìm sản phẩm, mã hàng..." />
            <button className="button button-secondary filter-button">
              <Filter size={15} /> Bộ lọc
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>SẢN PHẨM</th>
                <th>MÃ HÀNG</th>
                <th>TỒN KHO</th>
                <th>NGƯỠNG TỐI THIỂU</th>
                <th>HẠN SỬ DỤNG GẦN NHẤT</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const isLow = product.stock <= product.threshold
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-symbol">
                          <Droplets size={17} />
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.brand}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="sku-cell">{product.sku}</span>
                    </td>
                    <td>
                      <strong className="stock-number">
                        {product.stock} <small>{product.unit.toLowerCase()}</small>
                      </strong>
                    </td>
                    <td>
                      {product.threshold} {product.unit.toLowerCase()}
                    </td>
                    <td>
                      <span className={product.expiry !== '—' && product.expiry.startsWith('21') ? 'expiry-soon' : ''}>{product.expiry}</span>
                    </td>
                    <td>
                      <span className={`stock-state ${isLow ? 'low' : 'normal'}`}>
                        <i />
                        {isLow ? 'Sắp hết' : 'Đủ hàng'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length === 0 && <EmptyState icon={Search} title="Không có sản phẩm phù hợp" description="Thử tìm theo tên, mã hàng hoặc thương hiệu." />}
        </div>
      </div>

      <button className="button button-outline inventory-bottom-cta" onClick={onReceiveStock}>
        <Plus size={16} /> Tạo phiếu nhập hàng
      </button>
    </div>
  )
}
