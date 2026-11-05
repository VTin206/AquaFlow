import { Button, Drawer, Empty, InputNumber, Popconfirm, Skeleton, Space } from 'antd'
import { Minus, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { currency } from '@/shared/utils/format'
import { QueryError } from '@/shared/components/QueryError'
import { useCartActions, useCart } from '../cart'
import { useShopProducts } from '../shopService'
import { CartThumb } from './CartThumb'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const cart = useCart()
  const actions = useCartActions()
  const products = useShopProducts()
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * (line.product?.price ?? 0), 0)
  const invalid = lines.some((line) => !line.product || line.product.available === false)

  return (
    <Drawer open={open} onClose={onClose} title="Giỏ hàng" size={440}>
      {products.isPending ? (
        <Skeleton active />
      ) : products.isError ? (
        <QueryError error={products.error} onRetry={products.refetch} />
      ) : !cart.length ? (
        <Empty description="Giỏ hàng đang trống." />
      ) : (
        <>
          <ul className="af-shop-cart">
            {lines.map(({ productId, quantity, product }) => {
              const name = product?.name ?? `Sản phẩm ${productId}`
              return (
                <li key={productId}>
                  <CartThumb product={product} />
                  <div className="af-shop-cart-body">
                    <div className="af-shop-cart-head">
                      <strong>{name}</strong>
                      <button
                        type="button"
                        className="af-shop-cart-remove"
                        aria-label={`Bỏ ${name} khỏi giỏ`}
                        title="Bỏ khỏi giỏ"
                        onClick={() => actions.remove(productId)}
                      >
                        <Minus size={13} strokeWidth={3} aria-hidden />
                      </button>
                    </div>
                    <small>
                      {product
                        ? `${currency(product.price)} / ${product.unit.toLowerCase()}`
                        : 'Sản phẩm không còn trong danh mục. Vui lòng bỏ khỏi giỏ.'}
                      {product?.available === false && ' · Tạm hết hàng'}
                    </small>
                    <div className="af-shop-cart-foot">
                      <Space.Compact size="small">
                        <Button
                          icon={<Minus size={13} />}
                          aria-label={`Bớt ${name}`}
                          disabled={quantity <= 1}
                          onClick={() => actions.set(productId, quantity - 1)}
                        />
                        <InputNumber
                          aria-label={`Số lượng ${name}`}
                          min={1}
                          max={99}
                          precision={0}
                          controls={false}
                          value={quantity}
                          onChange={(value) => value && actions.set(productId, value)}
                          className="af-shop-cart-qty"
                        />
                        <Button
                          icon={<Plus size={13} />}
                          aria-label={`Thêm ${name}`}
                          disabled={quantity >= 99}
                          onClick={() => actions.set(productId, quantity + 1)}
                        />
                      </Space.Compact>
                      {product && <strong className="af-money">{currency(product.price * quantity)}</strong>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="af-order-summary">
            <span>Tiền hàng tạm tính</span>
            <strong>{currency(subtotal)}</strong>
          </div>
          <p className="af-form-hint">Chưa gồm phí giao và tiền cọc vỏ nếu có.</p>
          <Button
            style={{ marginTop: 16 }}
            type="primary"
            block
            size="large"
            disabled={invalid}
            onClick={() => {
              onClose()
              navigate('/checkout')
            }}
          >
            Thanh toán
          </Button>
          <div className="af-shop-cart-actions">
            <Button onClick={onClose}>Mua hàng tiếp</Button>
            <Popconfirm
              title="Xóa hết sản phẩm trong giỏ?"
              okText="Xóa hết"
              okButtonProps={{ danger: true }}
              cancelText="Không"
              onConfirm={actions.clear}
            >
              <Button danger>Xóa hết</Button>
            </Popconfirm>
          </div>
        </>
      )}
    </Drawer>
  )
}
