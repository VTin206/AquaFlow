import { useState } from 'react'
import { Button, Card, Descriptions, Empty, InputNumber, Skeleton, Space, Tag, Typography } from 'antd'
import { Minus, Plus, ShoppingCart, Zap } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
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
  return <div className="af-shop-page af-shop-narrow">
    <Link to="/shop" className="af-text-link">← Danh sách sản phẩm</Link>
    <Card style={{ marginTop: 16 }}>
      {query.isPending ? <Skeleton active /> : query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : !product ? <Empty description="Không tìm thấy sản phẩm." /> : <>
        {product.image && <img src={product.image} alt={product.name} style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }} />}
        <Typography.Title level={2}>{product.name}</Typography.Title>
        <p className="af-shop-detail-price"><span className="af-money af-shop-price">{currency(product.price)}</span> <small>/ {product.unit.toLowerCase()}</small></p>
        <Descriptions column={1} items={[
          { key: 'sku', label: 'Mã sản phẩm', children: product.sku },
          { key: 'brand', label: 'Thương hiệu', children: product.brand || 'Chưa cập nhật' },
          { key: 'pack', label: 'Quy cách', children: product.catalog?.packaging ?? (product.unitsPerCase ? `${product.unitsPerCase} đơn vị/thùng` : product.unit) },
          ...(product.catalog?.capacity ? [{ key: 'volume', label: 'Dung tích', children: product.catalog.capacity }] : []),
          ...(product.bottleTypeName ? [{ key: 'bottle', label: 'Loại vỏ', children: product.bottleTypeName }] : []),
        ]} />
        <p><Tag color={product.available === false ? 'default' : product.available ? 'green' : 'blue'}>{product.available === false ? 'Tạm ngừng bán / hết hàng' : product.available ? 'Có thể đặt' : 'Chưa có thông tin tồn kho'}</Tag></p>
        <div className="af-shop-buy">
          <Space.Compact className="af-shop-buy-qty">
            <Button icon={<Minus size={15} />} aria-label="Bớt số lượng" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} />
            <InputNumber aria-label="Số lượng" min={1} max={99} precision={0} controls={false} value={quantity} onChange={(value) => setQuantity(value ?? 1)} />
            <Button icon={<Plus size={15} />} aria-label="Thêm số lượng" disabled={quantity >= 99} onClick={() => setQuantity(quantity + 1)} />
          </Space.Compact>
          <Button size="large" icon={<ShoppingCart size={17} />} disabled={product.available === false} onClick={() => {
            actions.add(product.id, quantity)
            openCart()
          }}>Thêm vào giỏ</Button>
          {/* Mua ngay: thêm vào giỏ rồi sang thẳng trang thanh toán. */}
          <Button type="primary" size="large" icon={<Zap size={17} />} disabled={product.available === false} onClick={() => { actions.add(product.id, quantity); navigate('/checkout') }}>Mua ngay</Button>
        </div>
      </>}
    </Card>
  </div>
}
