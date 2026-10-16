import { useEffect, useState } from 'react'
import { App, Button, Card, Col, Empty, Input, Row, Segmented, Skeleton, Tag, Typography } from 'antd'
import { Droplets, Search, ShoppingCart, Truck } from 'lucide-react'
import { useOutletContext } from 'react-router'
import { QueryError } from '../../shared/components/QueryError'
import { DEPOSIT_PER_BOTTLE, FREE_DELIVERY_MIN_UNITS } from '../../shared/policy'
import { currency } from '../../shared/utils/format'
import { normalizeSearch } from '../inventory/catalog'
import { useSettings } from '../settings/settingsService'
import { cartActions, useCart } from './cart'
import { useShopProducts, type ShopProduct } from './shopService'

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
  const { data: settings } = useSettings()
  const cart = useCart()
  const [category, setCategory] = useState(ALL)
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = `Đặt nước | ${settings?.storeName ?? 'AquaFlow'}`
  }, [settings?.storeName])

  const products = productsQuery.data ?? []
  const categories = [ALL, ...new Set(products.map((product) => product.catalog?.category ?? 'Khác'))]
  const keyword = normalizeSearch(query.trim())
  const visible = products
    .filter((product) => (category === ALL || (product.catalog?.category ?? 'Khác') === category) && normalizeSearch(`${product.name} ${product.brand}`).includes(keyword))
    .sort((a, b) => Number(b.available) - Number(a.available))

  return (
    <div className="af-shop-page">
      <section className="af-shop-hero">
        <div>
          <Typography.Title level={2}>Đặt nước giao tận nơi</Typography.Title>
          <p>Không cần tài khoản. Đặt xong nhận liên kết riêng để theo dõi đơn và thanh toán chuyển khoản.</p>
        </div>
        <ul>
          <li>
            <Truck size={16} aria-hidden /> Miễn phí giao từ {FREE_DELIVERY_MIN_UNITS} bình/thùng
          </li>
          <li>
            <Droplets size={16} aria-hidden /> Khách mới chưa có vỏ: cọc {currency(DEPOSIT_PER_BOTTLE)}/vỏ, hoàn khi trả vỏ
          </li>
        </ul>
      </section>

      <div className="af-shop-toolbar">
        <Segmented value={category} onChange={(value) => setCategory(String(value))} options={categories} />
        <Input allowClear prefix={<Search size={16} className="af-input-icon" />} placeholder="Tìm sản phẩm, thương hiệu..." value={query} onChange={(event) => setQuery(event.target.value)} className="af-search" />
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
                    {!product.available && <Tag>Tạm hết hàng</Tag>}
                  </div>
                  <Typography.Title level={5} className="af-product-name" ellipsis={{ rows: 2, tooltip: product.name }}>
                    {product.name}
                  </Typography.Title>
                  <div className="af-shop-card-footer">
                    <span>
                      <strong className="af-money">{currency(product.price)}</strong>
                      <small> / {product.unit.toLowerCase()}</small>
                    </span>
                    <Button
                      type={inCart ? 'default' : 'primary'}
                      icon={<ShoppingCart size={15} />}
                      disabled={!product.available}
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
    </div>
  )
}
