import { useState } from 'react'
import { Button, Card, Col, Empty, Input, Pagination, Row, Select, Skeleton, Tag, Typography } from 'antd'
import { Droplets, LayoutGrid, Plus, RotateCcw, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { brandGroups, capacityGroups, catalogCategories, getBrandGroup, getCatalogDetails, normalizeSearch } from './catalog'
import { ProductFormModal } from './components/ProductFormModal'
import { isLowStock, type Product } from './types'
import { useProducts } from './useProducts'

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false)
  return product.image && !failed ? (
    <img src={product.image} alt={product.name} className="af-product-image" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="af-product-placeholder"><Droplets size={32} strokeWidth={1.5} aria-hidden /><span>Chưa có ảnh</span></div>
  )
}

export function ProductsPage() {
  const productsQuery = useProducts()
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [packaging, setPackaging] = useState<string>()
  const [capacity, setCapacity] = useState<string>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [creating, setCreating] = useState(false)
  const products = productsQuery.data ?? []
  const keyword = normalizeSearch(query.trim())
  const brandName = (product: Product) => getBrandGroup(product.brand)?.name ?? product.brand
  const brands = [...brandGroups.map((group) => group.name), ...new Set(products.filter((product) => !getBrandGroup(product.brand)).map((product) => product.brand))]
    .map((name) => ({ name, logo: brandGroups.find((group) => group.name === name)?.logo ?? products.find((product) => brandName(product) === name)?.image, count: products.filter((product) => brandName(product) === name).length }))
  const visible = products.filter((product) => {
    const details = getCatalogDetails(product)
    return (!brand || brandName(product) === brand)
      && (!category || details.category === category)
      && (!packaging || details.packaging === packaging)
      && (!capacity || details.capacity === capacity)
      && normalizeSearch(`${product.name} ${product.sku} ${product.brand} ${brandName(product)}`).includes(keyword)
  }).sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / pageSize)))
  const shown = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = Boolean(query || brand || category || packaging || capacity)
  const resetFilters = () => { setQuery(''); setBrand(undefined); setCategory(undefined); setPackaging(undefined); setCapacity(undefined); setPage(1) }
  const filterOptions = (field: 'packaging' | 'capacity') => {
    const values = [...new Set(products.map((product) => getCatalogDetails(product)[field]))]
    if (field === 'capacity') values.sort((a, b) => capacityGroups.indexOf(a) - capacityGroups.indexOf(b))
    return values.map((value) => ({ value, label: value }))
  }

  const renderBody = () => {
    if (productsQuery.isError) return <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
    if (productsQuery.isPending) return <Skeleton active paragraph={{ rows: 6 }} />
    if (visible.length === 0) return (
      <Empty description={brand && !brands.find((item) => item.name === brand)?.count ? `Chưa có sản phẩm ${brand} trong danh mục.` : hasFilters ? 'Không có sản phẩm phù hợp với bộ lọc.' : 'Chưa có sản phẩm nào.'}>
        {hasFilters ? <Button onClick={resetFilters}>Xóa bộ lọc</Button> : <Button type="primary" onClick={() => setCreating(true)}>Thêm sản phẩm đầu tiên</Button>}
      </Empty>
    )
    return (
      <>
        <Row gutter={[16, 16]}>
          {shown.map((product) => {
            const details = getCatalogDetails(product)
            return (
              <Col key={product.id} xs={24} sm={12} lg={8} xl={6}>
                <Card className="af-product-card" cover={<ProductImage key={product.image ?? product.id} product={product} />}>
                  <div className="af-product-brand-line"><span>{product.brand}</span><Tag>{details.category}</Tag></div>
                  <Typography.Title level={5} className="af-product-name">{product.name}</Typography.Title>
                  <p className="af-product-spec">{details.packaging} · {details.volumeMl ? (details.volumeMl >= 1000 ? `${(details.volumeMl / 1000).toLocaleString('vi-VN')}L` : `${details.volumeMl}ml`) : details.capacity}</p>
                  <Typography.Text type="secondary" className="af-product-sku">{product.sku}</Typography.Text>
                  <div className="af-product-footer">
                    <span className="af-money">{currency(product.price)}<Typography.Text type="secondary"> / {product.unit.toLowerCase()}</Typography.Text></span>
                    <Tag color={product.stock === 0 ? 'default' : isLowStock(product) ? 'orange' : 'green'}>{product.stock === 0 ? 'Chưa có hàng' : `Còn ${product.stock}`}</Tag>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
        <Pagination className="af-catalog-pagination" current={currentPage} pageSize={pageSize} total={visible.length} pageSizeOptions={[12, 24, 48]} showSizeChanger responsive onChange={(next, size) => { setPage(size !== pageSize ? 1 : next); setPageSize(size) }} />
      </>
    )
  }

  return (
    <Page title="Sản phẩm" description="Tra cứu theo thương hiệu, loại nước và quy cách đóng gói." actions={<Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Thêm sản phẩm</Button>}>
      <Card className="af-card">
        <div className="af-catalog-heading">
          <strong>Thương hiệu</strong>
          <Select className="af-brand-select" aria-label="Chọn thương hiệu" placeholder="Tất cả thương hiệu" allowClear showSearch={{ filterOption: (input, option) => normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)) }} value={brand} options={brands.map((item) => ({ value: item.name, label: `${item.name} (${item.count})` }))} onChange={(value) => { setBrand(value); setPage(1) }} />
        </div>
        <div className="af-brand-filters" role="group" aria-label="Lọc theo thương hiệu">
          <button type="button" className={`af-brand-filter${!brand ? ' is-active' : ''}`} aria-pressed={!brand} onClick={() => { setBrand(undefined); setPage(1) }}><LayoutGrid size={25} aria-hidden /><span>Tất cả <small>{products.length}</small></span></button>
          {brands.map((item) => (
            <button type="button" key={item.name} className={`af-brand-filter${brand === item.name ? ' is-active' : ''}`} aria-pressed={brand === item.name} onClick={() => { setBrand(brand === item.name ? undefined : item.name); setPage(1) }}>
              {item.logo ? <img src={item.logo} alt="" /> : <Droplets size={25} aria-hidden />}
              <span>{item.name} <small>{item.count}</small></span>
            </button>
          ))}
        </div>
        <div className="af-catalog-filters">
          <Input aria-label="Tìm sản phẩm" allowClear prefix={<Search size={16} className="af-input-icon" />} placeholder="Tìm tên, mã hàng, thương hiệu..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
          <Select aria-label="Loại nước" allowClear placeholder="Tất cả loại nước" value={category} options={catalogCategories.map((value) => ({ value, label: value }))} onChange={(value) => { setCategory(value); setPage(1) }} />
          <Select aria-label="Quy cách" allowClear placeholder="Tất cả quy cách" value={packaging} options={filterOptions('packaging')} onChange={(value) => { setPackaging(value); setPage(1) }} />
          <Select aria-label="Dung tích" allowClear placeholder="Tất cả dung tích" value={capacity} options={filterOptions('capacity')} onChange={(value) => { setCapacity(value); setPage(1) }} />
        </div>
        <div className="af-catalog-results"><Typography.Text type="secondary">Hiển thị {visible.length} sản phẩm{brand ? ` · ${brand}` : ''}</Typography.Text>{hasFilters && <Button type="link" size="small" icon={<RotateCcw size={14} />} onClick={resetFilters}>Xóa bộ lọc</Button>}</div>
        {renderBody()}
      </Card>
      <ProductFormModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}
