import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { App, Button, Card, Col, Dropdown, Empty, Input, Pagination, Row, Segmented, Select, Skeleton, Space, Tag, Tooltip, Typography, type MenuProps } from 'antd'
import { Droplets, Ellipsis, FunnelX, LayoutGrid, Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { ToneLabel } from '../../shared/components/ToneLabel'
import { QueryError } from '../../shared/components/QueryError'
import { useFeature, useIsDemo } from '../../shared/features'
import { currency } from '../../shared/utils/format'
import { LiveBottleTypes } from '../live/LiveBottleTypes'
import { brandGroups, capacityGroups, catalogCategories, getBrandGroup, getCatalogDetails, normalizeSearch } from './catalog'
import { ProductFormModal } from './components/ProductFormModal'
import { useActivateProduct, useCanManageProducts, useCatalog, useDeactivateProduct, type CatalogItem, type ProductStatus } from './productCatalog'

const statusOptions: { value: ProductStatus; label: ReactNode }[] = [
  { value: 'active', label: <ToneLabel tone="success">Đang bán</ToneLabel> },
  { value: 'inactive', label: <ToneLabel tone="neutral">Ngừng bán</ToneLabel> },
  { value: 'all', label: 'Tất cả' },
]

function ProductImage({ product }: { product: CatalogItem }) {
  const [failed, setFailed] = useState(false)
  return product.image && !failed ? (
    <img src={product.image} alt={product.name} className="af-product-image" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="af-product-placeholder"><Droplets size={32} strokeWidth={1.5} aria-hidden /><span>Chưa có ảnh</span></div>
  )
}

function StockTag({ product }: { product: CatalogItem }) {
  if (!product.active || product.stock === undefined) return null
  return <Tag color={product.stock === 0 ? 'default' : product.lowStock ? 'orange' : 'green'}>{product.stock === 0 ? 'Chưa có hàng' : `Còn ${product.stock}`}</Tag>
}

export function ProductsPage() {
  const { message, modal } = App.useApp()
  const demo = useIsDemo()
  const canManage = useCanManageProducts()
  const showDetails = useFeature('productCatalogDetails')
  const [status, setStatus] = useState<ProductStatus>('active')
  // Nhân viên không quản lý chỉ xem sản phẩm đang bán (BE cũng giới hạn như vậy).
  const productsQuery = useCatalog(canManage ? status : 'active')
  const deactivate = useDeactivateProduct()
  const activate = useActivateProduct()
  const canReactivate = useFeature('reactivate')
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [packaging, setPackaging] = useState<string>()
  const [capacity, setCapacity] = useState<string>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  // undefined: đóng; null: thêm mới; CatalogItem: sửa.
  const [editing, setEditing] = useState<CatalogItem | null>()
  const [bottlesOpen, setBottlesOpen] = useState(false)
  const products = productsQuery.data ?? []
  const keyword = normalizeSearch(query.trim())
  const brandName = (product: CatalogItem) => getBrandGroup(product.brand)?.name ?? product.brand
  // Bản dùng thử giới thiệu đủ các nhóm thương hiệu; tài khoản thật chỉ hiện thương hiệu đang có sản phẩm.
  const groupNames = demo ? brandGroups.map((group) => group.name) : []
  const brands = [...new Set([...groupNames, ...products.map(brandName)])]
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
  // Còn hàng mà ngừng bán thường là bấm nhầm, nên hộp xác nhận nhắc số tồn.
  const confirmStop = (product: CatalogItem) => modal.confirm({
    title: 'Ngừng bán?',
    content: (
      <div className="af-confirm-body">
        <p><strong>{product.name}</strong> sẽ không còn trên cửa hàng và không nhập kho được.</p>
        {product.stock ? <p className="af-confirm-warning">Trong kho còn <strong>{product.stock} {product.unit.toLowerCase()}</strong>.</p> : null}
        <p>Đơn và phiếu nhập cũ vẫn giữ nguyên.</p>
      </div>
    ),
    centered: true,
    okText: 'Ngừng bán', okButtonProps: { danger: true },
    cancelText: 'Không',
    onOk: () => deactivate.mutateAsync(product.id).then(
      () => { message.success(`Đã ngừng bán ${product.name}.`) },
      (error: Error) => { message.error(error.message) },
    ),
  })
  const resumeSelling = (product: CatalogItem) =>
    activate.mutateAsync(product.id).then(
      () => { message.success(`Đã bán lại ${product.name}.`) },
      (error: Error) => { message.error(error.message) },
    )
  const cardMenu = (product: CatalogItem): MenuProps['items'] => [
    { key: 'edit', label: 'Sửa thông tin', onClick: () => setEditing(product) },
    { type: 'divider' },
    // Thao tác ngừng tô đỏ để tách khỏi thao tác thường; hộp xác nhận nói rõ hậu quả.
    product.active
      ? { key: 'stop', label: 'Ngừng bán', danger: true, disabled: deactivate.isPending, onClick: () => confirmStop(product) }
      : { key: 'resume', label: 'Bán lại', disabled: !canReactivate || activate.isPending, extra: canReactivate ? undefined : 'Chưa hỗ trợ', onClick: () => void resumeSelling(product) },
  ]

  const renderBody = () => {
    if (productsQuery.isError) return <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
    if (productsQuery.isPending) return <Skeleton active paragraph={{ rows: 6 }} />
    if (visible.length === 0) return (
      <Empty description={brand && !brands.find((item) => item.name === brand)?.count ? `Chưa có sản phẩm ${brand} trong danh mục.` : hasFilters ? 'Không có sản phẩm phù hợp với bộ lọc.' : status === 'inactive' ? 'Không có sản phẩm đã ngừng bán.' : 'Chưa có sản phẩm nào.'}>
        {hasFilters ? <Button icon={<FunnelX size={16} />} onClick={resetFilters}>Xóa bộ lọc</Button> : canManage && status !== 'inactive' && <Button type="primary" onClick={() => setEditing(null)}>Thêm sản phẩm đầu tiên</Button>}
      </Empty>
    )
    return (
      <>
        <Row gutter={[16, 16]}>
          {shown.map((product) => {
            const details = getCatalogDetails(product)
            const spec = showDetails
              ? `${details.packaging} · ${details.volumeMl ? (details.volumeMl >= 1000 ? `${(details.volumeMl / 1000).toLocaleString('vi-VN')}L` : `${details.volumeMl}ml`) : details.capacity}`
              : [product.unitsPerCase && `${product.unitsPerCase} ${product.unit.toLowerCase()}/thùng`, product.bottleTypeName && `Vỏ ${product.bottleTypeName}`].filter(Boolean).join(' · ')
            return (
              <Col key={product.id} xs={24} sm={12} lg={8} xl={6}>
                {/* Người quản lý bấm thẻ để sửa; thao tác khác nằm trong ⋯ ở góc ảnh. */}
                <Card
                  className={`af-product-card${product.active ? '' : ' is-inactive'}${canManage ? ' is-editable' : ''}`}
                  hoverable={canManage}
                  {...(canManage && {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Sửa ${product.name}`,
                    onClick: () => setEditing(product),
                    onKeyDown: (event: KeyboardEvent) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setEditing(product) } },
                  })}
                  cover={
                    <div className="af-product-cover">
                      <ProductImage key={product.image ?? product.id} product={product} />
                      {!product.active && <Tag className="af-product-cover-tag">Ngừng bán</Tag>}
                      {canManage && (
                        // Menu render qua portal nhưng sự kiện React vẫn nổi lên thẻ, nên chặn để không mở form sửa.
                        <span className="af-product-menu" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                          <Dropdown trigger={['click']} menu={{ items: cardMenu(product) }}>
                            <Button size="small" icon={<Ellipsis size={16} />} aria-label={`Thao tác với ${product.name}`} />
                          </Dropdown>
                        </span>
                      )}
                    </div>
                  }
                >
                  <div className="af-product-brand-line"><span>{brandName(product)}</span><Tag>{details.category}</Tag></div>
                  <Typography.Title level={5} className="af-product-name">{product.name}</Typography.Title>
                  {spec && <p className="af-product-spec">{spec}</p>}
                  <Typography.Text type="secondary" className="af-product-sku">{product.sku}</Typography.Text>
                  <div className="af-product-footer">
                    <span className="af-money">{currency(product.price)}<Typography.Text type="secondary"> / {product.unit.toLowerCase()}</Typography.Text></span>
                    <StockTag product={product} />
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
    <Page
      title="Sản phẩm"
      description="Tra cứu theo thương hiệu, loại nước và quy cách đóng gói."
      actions={
        <Space wrap>
          {!demo && <Button onClick={() => setBottlesOpen(true)}>Loại vỏ bình</Button>}
          {canManage && <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>Thêm sản phẩm</Button>}
        </Space>
      }
    >
      <Card className="af-card">
        <div className="af-catalog-heading">
          <strong>Thương hiệu</strong>
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
          <Tooltip title={showDetails ? undefined : 'Backend chưa hỗ trợ loại nước'}>
            <Select aria-label="Loại nước" allowClear disabled={!showDetails} placeholder={showDetails ? 'Tất cả loại nước' : 'Loại nước (chưa hỗ trợ)'} value={category} options={catalogCategories.map((value) => ({ value, label: value }))} onChange={(value) => { setCategory(value); setPage(1) }} />
          </Tooltip>
          <Select aria-label="Quy cách" allowClear placeholder="Tất cả quy cách" value={packaging} options={filterOptions('packaging')} onChange={(value) => { setPackaging(value); setPage(1) }} />
          <Tooltip title={showDetails ? undefined : 'Backend chưa hỗ trợ dung tích'}>
            <Select aria-label="Dung tích" allowClear disabled={!showDetails} placeholder={showDetails ? 'Tất cả dung tích' : 'Dung tích (chưa hỗ trợ)'} value={capacity} options={filterOptions('capacity')} onChange={(value) => { setCapacity(value); setPage(1) }} />
          </Tooltip>
        </div>
        <div className="af-catalog-results">
          {canManage && <Segmented<ProductStatus> value={status} onChange={(next) => { setStatus(next); setPage(1) }} options={statusOptions} />}
          <Typography.Text type="secondary">Hiển thị {visible.length} sản phẩm{brand ? ` · ${brand}` : ''}</Typography.Text>
          {hasFilters && <Button type="link" size="small" className="af-clear-filter" icon={<FunnelX size={14} />} onClick={resetFilters}>Xóa bộ lọc</Button>}
        </div>
        {renderBody()}
      </Card>
      <ProductFormModal key={editing?.id ?? 'new'} open={editing !== undefined} product={editing ?? undefined} onClose={() => setEditing(undefined)} />
      {bottlesOpen && <LiveBottleTypes onClose={() => setBottlesOpen(false)} />}
    </Page>
  )
}
