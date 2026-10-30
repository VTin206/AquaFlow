import { useEffect, useRef, useState } from 'react'
import { App, Button, Card, Col, Empty, Input, Row, Select, Skeleton, Tag, Typography, type InputRef } from 'antd'
import { Droplets, Search, ShoppingCart } from 'lucide-react'
import { Link, useLocation, useOutletContext } from 'react-router'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { normalizeSearch } from '../inventory/catalog'
import { useSettings } from '../settings/settingsService'
import { useCartActions, useCart } from './cart'
import { ShopIntro } from './components/ShopIntro'
import { shopGroups } from './shopGroups'
import { useShopDemo, useShopProducts, type ShopProduct } from './shopService'

const ALL = 'Tất cả'

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
  const { message } = App.useApp()
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const productsQuery = useShopProducts()
  const demo = useShopDemo()
  const { data: settings } = useSettings(demo)
  const cartActions = useCartActions()
  const cart = useCart()
  const [group, setGroup] = useState<string>(ALL)
  const [category, setCategory] = useState(ALL)
  const [query, setQuery] = useState('')
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
  const categories = [...new Set(products.map((product) => product.catalog?.category ?? 'Khác'))]
  const inGroup = (product: ShopProduct, key: string) => key === ALL || shopGroups.find((item) => item.key === key)?.match(product)
  const groupOptions = [
    { value: ALL, label: `Tất cả (${products.length})` },
    ...shopGroups
      .map((item) => ({ value: item.key, label: item.label, count: products.filter(item.match).length }))
      .filter((item) => item.count > 0)
      .map((item) => ({ value: item.value, label: `${item.label} (${item.count})` })),
  ]
  const keyword = normalizeSearch(query.trim())
  const visible = products
    .filter(
      (product) =>
        inGroup(product, group) &&
        (category === ALL || (product.catalog?.category ?? 'Khác') === category) &&
        normalizeSearch(`${product.name} ${product.brand}`).includes(keyword),
    )
    .sort((a, b) => Number(b.available) - Number(a.available))

  return (
    <div className="af-shop-page">
      <ShopIntro
        demo={demo}
        storeName={demo ? settings?.storeName : undefined}
        phone={demo ? settings?.phone : undefined}
        products={products}
        onShop={goToCatalog}
        onBrand={(brand) => { setGroup(ALL); setCategory(ALL); setQuery(brand); goToCatalog() }}
      />

      <section ref={catalogRef} className="af-shop-catalog" aria-labelledby="af-shop-catalog-title">
        <div className="af-shop-hero">
          <div>
            <Typography.Title level={2} id="af-shop-catalog-title">Sản phẩm</Typography.Title>
            <p>{demo ? 'Bản dùng thử: đặt đơn không cần tài khoản khách hàng và xem trạng thái mô phỏng.' : 'Chọn sản phẩm và đặt hàng không cần tài khoản.'}</p>
          </div>
        </div>

        <div className="af-shop-toolbar">
          <div className="af-shop-groups" role="group" aria-label="Loại bình, chai">
            {groupOptions.map((option) => (
              <Tag.CheckableTag key={option.value} checked={group === option.value} onChange={() => setGroup(option.value)}>
                {option.label}
              </Tag.CheckableTag>
            ))}
          </div>
        </div>
        <div className="af-shop-toolbar">
          <Select
            aria-label="Dòng nước"
            value={category}
            onChange={setCategory}
            style={{ minWidth: 200 }}
            options={[{ value: ALL, label: 'Mọi dòng nước' }, ...categories.map((value) => ({ value, label: value }))]}
          />
          <Input ref={searchRef} allowClear prefix={<Search size={16} className="af-input-icon" />} placeholder="Tìm sản phẩm, thương hiệu..." value={query} onChange={(event) => setQuery(event.target.value)} className="af-search" />
        </div>

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
            {visible.map((product) => {
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
                        <strong className="af-money">{currency(product.price)}</strong>
                        <small> / {product.unit.toLowerCase()}</small>
                      </span>
                      <Button
                        type={inCart ? 'default' : 'primary'}
                        icon={<ShoppingCart size={15} />}
                        disabled={product.available === false}
                        onClick={() => {
                          cartActions.add(product.id)
                          message.open({
                            type: 'success',
                            content: (
                              <span>
                                Đã thêm {product.name}.{' '}
                                <Button type="link" size="small" onClick={openCart}>
                                  Xem giỏ
                                </Button>
                              </span>
                            ),
                          })
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
      </section>
    </div>
  )
}
