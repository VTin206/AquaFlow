import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Empty, Pagination, Row, Skeleton, Tag, Typography, type InputRef } from 'antd'
import { Droplets, ShoppingCart } from 'lucide-react'
import { Link, useLocation, useOutletContext } from 'react-router'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { useSettings } from '../settings/settingsService'
import { useCartActions, useCart } from './cart'
import { ShopFilters } from './components/ShopFilters'
import { ShopIntro } from './components/ShopIntro'
import { emptyFilters, filterProducts, type ShopFilterState } from './shopGroups'
import { useShopDemo, useShopProducts, type ShopProduct } from './shopService'

function ShopImage({ product }: { product: ShopProduct }) {
  const [failed, setFailed] = useState(false)
  return product.image && !failed ? (
    <img src={product.image} alt={product.name} className="af-product-image" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="af-product-placeholder">
      <Droplets size={32} strokeWidth={1.5} aria-hidden />
    </div>
  )
}

export function ShopPage() {
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const productsQuery = useShopProducts()
  const demo = useShopDemo()
  const { data: settings } = useSettings(demo)
  const cartActions = useCartActions()
  const cart = useCart()
  const [filters, setFilters] = useState<ShopFilterState>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  // Đổi bộ lọc thì về trang 1 để không rơi vào trang trống.
  const updateFilters = (next: Partial<ShopFilterState>) => { setFilters((current) => ({ ...current, ...next })); setPage(1) }
  const catalogRef = useRef<HTMLElement>(null)
  const searchRef = useRef<InputRef>(null)
  const goToCatalog = () => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Nút kính lúp trên đầu trang: cuộn tới danh mục và đặt con trỏ vào ô tìm kiếm.
  const focusSearch = (useLocation().state as { focusSearch?: number } | null)?.focusSearch
  useEffect(() => {
    if (!focusSearch) return
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    searchRef.current?.focus({ preventScroll: true })
  }, [focusSearch])

  useEffect(() => {
    document.title = `Đặt nước | ${demo ? settings?.storeName ?? 'AquaFlow' : 'AquaFlow'}`
  }, [demo, settings?.storeName])

  const products = productsQuery.data ?? []
  const visible = filterProducts(products, filters)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / pageSize)))
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="af-shop-page">
      <ShopIntro
        demo={demo}
        storeName={demo ? settings?.storeName : undefined}
        phone={demo ? settings?.phone : undefined}
        products={products}
        onShop={goToCatalog}
      />

      <section ref={catalogRef} className="af-shop-catalog" aria-labelledby="af-shop-catalog-title">
        <div className="af-shop-hero">
          <div>
            <Typography.Title level={2} id="af-shop-catalog-title">Sản phẩm</Typography.Title>
            <p>{demo ? 'Bản dùng thử: đặt đơn không cần tài khoản khách hàng và xem trạng thái mô phỏng.' : 'Chọn sản phẩm và đặt hàng không cần tài khoản.'}</p>
          </div>
        </div>

        <ShopFilters products={products} filters={filters} visibleCount={visible.length} onChange={updateFilters} searchRef={searchRef} />

        {productsQuery.isError ? (
          <Card>
            <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
          </Card>
        ) : productsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : visible.length === 0 ? (
          <Empty description="Không có sản phẩm phù hợp." />
        ) : (
          <Row gutter={[16, 16]}>
            {pageItems.map((product) => {
              const inCart = cart.find((line) => line.productId === product.id)?.quantity ?? 0
              return (
                <Col key={product.id} xs={12} md={8} xl={6}>
                  <Card className="af-product-card af-shop-card" cover={<ShopImage product={product} />}>
                    <div className="af-product-brand-line">
                      <span>{product.brand}</span>
                      {product.available === false && <Tag>Tạm hết hàng</Tag>}
                    </div>
                    <Typography.Title level={5} className="af-product-name" ellipsis={{ rows: 2, tooltip: product.name }}>
                      <Link to={`/shop/products/${encodeURIComponent(product.id)}`}>{product.name}</Link>
                    </Typography.Title>
                    <div className="af-shop-card-footer">
                      <span>
                        <strong className="af-money af-shop-price">{currency(product.price)}</strong>
                        <small> / {product.unit.toLowerCase()}</small>
                      </span>
                      <Button
                        type={inCart ? 'default' : 'primary'}
                        icon={<ShoppingCart size={15} />}
                        disabled={product.available === false}
                        onClick={() => {
                          // Thêm xong mở giỏ để khách thấy ngay và chỉnh số lượng.
                          cartActions.add(product.id)
                          openCart()
                        }}
                      >
                        {inCart ? `Thêm (${inCart})` : 'Thêm'}
                      </Button>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
        {visible.length > pageSize && (
          <Pagination
            className="af-catalog-pagination"
            current={currentPage}
            pageSize={pageSize}
            total={visible.length}
            pageSizeOptions={[12, 24, 48]}
            showSizeChanger
            responsive
            onChange={(next, size) => { setPage(size !== pageSize ? 1 : next); setPageSize(size); goToCatalog() }}
          />
        )}
      </section>
    </div>
  )
}
