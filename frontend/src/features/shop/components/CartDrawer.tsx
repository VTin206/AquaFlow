import { Alert, Button, Drawer, Empty, InputNumber, Skeleton } from 'antd'
import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { currency } from '../../../shared/utils/format'
import { QueryError } from '../../../shared/components/QueryError'
import { useCartActions, useCart } from '../cart'
import { useShopDemo, useShopProducts } from '../shopService'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const cart = useCart()
  const actions = useCartActions()
  const demo = useShopDemo()
  const products = useShopProducts()
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * (line.product?.price ?? 0), 0)
  const invalid = lines.some((line) => !line.product || line.product.available === false)

  return <Drawer open={open} onClose={onClose} title="Giỏ hàng" size={440}>
    {products.isPending ? <Skeleton active /> : products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : !cart.length ? <Empty description="Giỏ hàng đang trống." /> : <>
      <ul className="af-shop-cart">
        {lines.map(({ productId, quantity, product }) => <li key={productId}>
          <div><strong>{product?.name ?? `Sản phẩm ${productId}`}</strong><small>{product ? `${currency(product.price)} / ${product.unit}` : 'Sản phẩm không còn trong danh mục. Vui lòng bỏ khỏi giỏ.'}{product?.available === false && ' · Tạm hết hàng'}</small></div>
          <InputNumber aria-label={`Số lượng ${product?.name ?? productId}`} min={1} max={99} precision={0} value={quantity} onChange={(value) => value && actions.set(productId, value)} style={{ width: 72 }} />
          <Button type="text" danger icon={<Trash2 size={16} />} aria-label={`Bỏ ${product?.name ?? productId}`} onClick={() => actions.remove(productId)} />
        </li>)}
      </ul>
      <div className="af-order-summary"><span>Tiền hàng tạm tính</span><strong>{currency(subtotal)}</strong></div>
      <p className="af-form-hint">Chưa gồm phí giao và tiền cọc vỏ nếu có.</p>
      {!demo && <Alert type="info" showIcon title="Chưa nhận đặt hàng trực tuyến" description="Bạn có thể chuẩn bị giỏ và thông tin giao hàng. Chưa có đơn hàng nào được gửi." />}
      <Button style={{ marginTop: 16 }} type="primary" block size="large" disabled={invalid} onClick={() => { onClose(); navigate('/checkout') }}>Tiếp tục đến Checkout</Button>
    </>}
  </Drawer>
}
