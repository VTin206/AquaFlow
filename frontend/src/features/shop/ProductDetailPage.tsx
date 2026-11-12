import { useState } from 'react'
import { Button, Card, Descriptions, Empty, InputNumber, Skeleton, Space, Tag, Typography } from 'antd'
import { Droplets, Minus, Plus, ShoppingCart, Zap } from 'lucide-react'
import { useNavigate, useOutletContext, useParams } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { UNCATEGORIZED } from '@/features/inventory/catalogGroups'
import { useCartActions } from './cart'
import { useShopProduct } from './shopService'

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const query = useShopProduct(id)
  const actions = useCartActions()
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const product = query.data
  return (
    <div className="af-shop-page af-shop-detail-page">
      <Card>
        {query.isPending ? (
          <Skeleton active />
        ) : query.isError ? (
          <QueryError error={query.error} onRetry={query.refetch} />
        ) : !product ? (
          <Empty description="Không tìm thấy sản phẩm." />
        ) : (
          // Ảnh bên trái; tên, giá, nút mua bên phải để thấy ngay không cần cuộn. Màn hình hẹp thì xếp dọc.
          <div className="af-shop-detail-layout">
            <div className="af-shop-detail-media">
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <Droplets size={72} strokeWidth={1.2} aria-hidden className="af-shop-detail-placeholder" />
              )}
            </div>
            <div className="af-shop-detail-main">
              <Typography.Title level={2}>{product.name}</Typography.Title>
              <p className="af-shop-detail-price">
                <span className="af-money af-shop-price">{currency(product.price)}</span> <small>/ {product.unit.toLowerCase()}</small>
              </p>
              <p>
                <Tag color={product.available === false ? 'default' : product.available ? 'green' : 'blue'}>
                  {product.available === false
                    ? 'Tạm ngừng bán / hết hàng'
                    : product.available
                      ? 'Có thể đặt'
                      : 'Chưa có thông tin tồn kho'}
                </Tag>
              </p>
              <div className="af-shop-buy">
                <Space.Compact className="af-shop-buy-qty">
                  <Button
                    icon={<Minus size={15} />}
                    aria-label="Bớt số lượng"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(quantity - 1)}
                  />
                  <InputNumber
                    aria-label="Số lượng"
                    min={1}
                    max={99}
                    precision={0}
                    controls={false}
                    value={quantity}
                    onChange={(value) => setQuantity(value ?? 1)}
                  />
                  <Button
                    icon={<Plus size={15} />}
                    aria-label="Thêm số lượng"
                    disabled={quantity >= 99}
                    onClick={() => setQuantity(quantity + 1)}
                  />
                </Space.Compact>
                <Button
                  className="af-shop-add-button"
                  type="primary"
                  size="large"
                  icon={<ShoppingCart size={17} />}
                  disabled={product.available === false}
                  onClick={() => {
                    actions.add(product.id, quantity)
                    openCart()
                  }}
                >
                  Thêm vào giỏ
                </Button>
                {/* Mua ngay: thêm vào giỏ rồi sang thẳng trang thanh toán. */}
                <Button
                  type="primary"
                  size="large"
                  icon={<Zap size={17} />}
                  disabled={product.available === false}
                  onClick={() => {
                    actions.add(product.id, quantity)
                    navigate('/checkout')
                  }}
                >
                  Mua ngay
                </Button>
              </div>
              {/* Thông số dưới nút mua; mã sản phẩm để cuối vì khách ít cần. */}
              <Descriptions
                className="af-shop-detail-specs"
                column={1}
                size="small"
                items={[
                  { key: 'brand', label: 'Thương hiệu', children: product.brand || 'Chưa cập nhật' },
                  ...(product.catalog && product.catalog.category !== UNCATEGORIZED
                    ? [{ key: 'category', label: 'Loại', children: product.catalog.category }]
                    : []),
                  {
                    key: 'pack',
                    label: 'Quy cách',
                    children: product.catalog?.packaging ?? (product.unitsPerCase ? `${product.unitsPerCase} đơn vị/thùng` : product.unit),
                  },
                  ...(product.catalog?.capacity ? [{ key: 'volume', label: 'Dung tích', children: product.catalog.capacity }] : []),
                  ...(product.bottleTypeName ? [{ key: 'bottle', label: 'Loại vỏ', children: product.bottleTypeName }] : []),
                  { key: 'sku', label: 'Mã sản phẩm', children: product.sku },
                ]}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
