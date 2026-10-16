import { ChevronDown, Ellipsis, Filter, Search, Waves } from 'lucide-react'
import { useState } from 'react'
import { SearchField } from '../components/SearchField'
import { EmptyState, QueryFallback } from '../components/StateViews'
import { useProducts } from '../hooks/useProducts'
import { currency } from '../utils/format'

export function ProductsPage() {
  const productsQuery = useProducts()
  const [query, setQuery] = useState('')

  if (productsQuery.isPending || productsQuery.isError) return <QueryFallback query={productsQuery} />

  const products = productsQuery.data
  const visible = products.filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="page-content subpage-content">
      <div className="surface data-surface">
        <div className="toolbar">
          <div className="toolbar-copy">
            <strong>Danh mục sản phẩm</strong>
            <span>{products.length} sản phẩm đang kinh doanh</span>
          </div>
          <div className="toolbar-controls">
            <SearchField value={query} onChange={setQuery} placeholder="Tìm tên hoặc mã sản phẩm..." />
            <button className="button button-secondary filter-button">
              <Filter size={15} /> Danh mục <ChevronDown size={14} />
            </button>
          </div>
        </div>
        <div className="product-grid">
          {visible.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div className={`product-art art-tone-${index % 4}`}>
                {product.image ? (
                  <img className="uploaded-product-image" src={product.image} alt={product.name} />
                ) : (
                  <div className="mini-bottle">
                    <i />
                    <span>
                      <Waves size={20} />
                    </span>
                  </div>
                )}
                <button className="product-more" aria-label="Tùy chọn sản phẩm">
                  <Ellipsis size={19} />
                </button>
                <span className="product-category">{product.brand}</span>
              </div>
              <div className="product-card-copy">
                <span className="sku-cell">{product.sku}</span>
                <h3>{product.name}</h3>
                <div className="product-card-bottom">
                  <strong>
                    {currency(product.price)} <small>/ {product.unit.toLowerCase()}</small>
                  </strong>
                  <span className={product.stock <= product.threshold ? 'low-text' : 'stock-text'}>{product.stock} còn kho</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && <EmptyState icon={Search} title="Không có sản phẩm phù hợp" description="Thử tìm theo tên, mã hàng hoặc thương hiệu." />}
      </div>
    </div>
  )
}
