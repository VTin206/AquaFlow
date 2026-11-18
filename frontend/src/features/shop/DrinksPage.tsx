import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Col, Empty, Pagination, Row, Skeleton, Tag, Typography, type InputRef } from 'antd'
import { Droplets, ShoppingCart } from 'lucide-react'
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useCart, useCartActions } from './cart'
import { ShopFilters } from './components/ShopFilters'
import { ALL, filterProducts, type ShopFilterState } from './shopGroups'
import { useBestSellerIds, useShopContact, useShopProducts, type ShopProduct } from './shopService'

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

function filtersFromParams(params: URLSearchParams): ShopFilterState {
  return {
    brand: params.get('brand') || ALL,
    group: params.get('group') || ALL,
    category: params.get('category') || ALL,
    query: params.get('q') || '',
  }
}

/** Catalog riêng cho mục Nước uống, tách khỏi trang chủ giới thiệu cửa hàng. */
export function DrinksPage() {
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const productsQuery = useShopProducts()
  const bestSellerIds = useBestSellerIds()
  const contact = useShopContact()
  const cartActions = useCartActions()
  const cart = useCart()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const filters = filtersFromParams(searchParams)
  const catalogRef = useRef<HTMLElement>(null)
  const searchRef = useRef<InputRef>(null)
  const focusSearch = (location.state as { focusSearch?: number } | null)?.focusSearch

  const updateFilters = (next: Partial<ShopFilterState>) => {
    const merged = { ...filters, ...next }
    const params = new URLSearchParams()
    if (merged.brand !== ALL) params.set('brand', merged.brand)
    if (merged.group !== ALL) params.set('group', merged.group)
    if (merged.category !== ALL) params.set('category', merged.category)
    if (merged.query.trim()) params.set('q', merged.query.trim())
    setSearchParams(params, { replace: true })
    setPage(1)
  }

  useEffect(() => {
    requestAnimationFrame(() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.search])

  useEffect(() => {
    if (!focusSearch) return
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      searchRef.current?.focus({ preventScroll: true })
    })
  }, [focusSearch])

  useEffect(() => {
    document.title = `Nước uống | ${contact?.storeName ?? 'AquaFlow'}`
  }, [contact?.storeName])

  const products = productsQuery.data ?? []
  const visible = filterProducts(products, filters, bestSellerIds)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / pageSize)))
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="af-shop-page">
      <section id="products" ref={catalogRef} className="af-shop-catalog" aria-label="Danh sách nước uống">
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
              const card = (
                <Card
                  className="af-product-card af-shop-card"
                  cover={
                    // Bấm ảnh cũng mở chi tiết; bàn phím và trình đọc màn hình dùng link ở tên nên bỏ khỏi thứ tự Tab.
                    <Link
                      to={`/shop/products/${encodeURIComponent(product.id)}`}
                      className="af-shop-card-cover-link"
                      tabIndex={-1}
                      aria-hidden
                    >
                      <ShopImage product={product} />
                    </Link>
                  }
                >
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
                      className="af-shop-add-button"
                      type="primary"
                      icon={<ShoppingCart size={15} />}
                      disabled={product.available === false}
                      onClick={() => {
                        cartActions.add(product.id)
                        openCart()
                      }}
                    >
                      {inCart ? `Thêm (${inCart})` : 'Thêm'}
                    </Button>
                  </div>
                </Card>
              )
              return (
                <Col key={product.id} xs={12} md={8} xl={6}>
                  {bestSellerIds.includes(product.id) ? (
                    <Badge.Ribbon text="Bán chạy" color="red" className="af-shop-best-seller">
                      {card}
                    </Badge.Ribbon>
                  ) : (
                    card
                  )}
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
            onChange={(next, size) => {
              setPage(size !== pageSize ? 1 : next)
              setPageSize(size)
              catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )}
      </section>
    </div>
  )
}
