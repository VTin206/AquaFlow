import { App, Button, Card, Descriptions, Empty, Skeleton, Space, Tag, Typography } from 'antd'
import { Link, useOutletContext, useParams } from 'react-router'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { useCartActions } from './cart'
import { useShopProduct } from './shopService'

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const query = useShopProduct(id)
  const actions = useCartActions()
  const { message } = App.useApp()
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const product = query.data
  return <div className="af-shop-page af-shop-narrow">
    <Link to="/shop" className="af-text-link">← Danh sách sản phẩm</Link>
    <Card style={{ marginTop: 16 }}>
      {query.isPending ? <Skeleton active /> : query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : !product ? <Empty description="Không tìm thấy sản phẩm." /> : <>
        {product.image && <img src={product.image} alt={product.name} style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }} />}
        <Typography.Title level={2}>{product.name}</Typography.Title>
        <Typography.Title level={3}>{currency(product.price)} / {product.unit}</Typography.Title>
        <Descriptions column={1} items={[
          { key: 'sku', label: 'Mã sản phẩm', children: product.sku },
          { key: 'brand', label: 'Thương hiệu', children: product.brand || 'Chưa cập nhật' },
          { key: 'pack', label: 'Quy cách', children: product.catalog?.packaging ?? (product.unitsPerCase ? `${product.unitsPerCase} đơn vị/thùng` : product.unit) },
          ...(product.catalog?.capacity ? [{ key: 'volume', label: 'Dung tích', children: product.catalog.capacity }] : []),
          ...(product.bottleTypeName ? [{ key: 'bottle', label: 'Loại vỏ', children: product.bottleTypeName }] : []),
        ]} />
        <p><Tag color={product.available === false ? 'default' : product.available ? 'green' : 'blue'}>{product.available === false ? 'Tạm ngừng bán / hết hàng' : product.available ? 'Có thể đặt' : 'Chưa có thông tin tồn kho'}</Tag></p>
        <Space wrap>
          <Button type="primary" disabled={product.available === false} onClick={() => { actions.add(product.id); message.success('Đã thêm vào giỏ hàng.') }}>Thêm vào giỏ</Button>
          <Button onClick={openCart}>Xem giỏ hàng</Button>
        </Space>
      </>}
    </Card>
  </div>
}
