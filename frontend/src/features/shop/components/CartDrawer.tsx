import { Button, Drawer, Empty, InputNumber, Popconfirm, Skeleton, Space } from 'antd'
import { Minus, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
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
  const ready = !products.isPending && !products.isError && cart.length > 0

  // Tiền và nút đặt hàng nằm ở chân drawer nên luôn thấy; chỉ danh sách sản phẩm cuộn.
  const footer = ready ? (
    <div className="af-shop-cart-checkout">
      <div className="af-order-summary">
        <span>Tiền hàng tạm tính</span>
        <strong>{currency(subtotal)}</strong>
      </div>
      <p className="af-form-hint">Chưa gồm phí giao và tiền cọc vỏ nếu có.</p>
      <Button
        className="af-shop-cart-order"
        type="primary"
        size="large"
        block
        disabled={invalid}
        onClick={() => {
          onClose()
          navigate('/checkout')
        }}
      >
        Đặt hàng
      </Button>
      <div className="af-shop-cart-actions">
        {/* Đang ở trang nào cũng về danh mục sản phẩm để chọn thêm. */}
        <Button
          size="large"
          onClick={() => {
            onClose()
            navigate('/shop/drinks')
          }}
        >
          Mua hàng tiếp
        </Button>
        <Popconfirm
          title="Xóa hết sản phẩm trong giỏ?"
          okText="Xóa hết"
          okButtonProps={{ danger: true }}
          cancelText="Không"
          onConfirm={actions.clear}
        >
          <Button danger size="large">
            Xóa hết
          </Button>
        </Popconfirm>
      </div>
    </div>
  ) : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Giỏ hàng"
      size={440}
      footer={footer}
      // Chân giỏ thoáng hơn mặc định để hai hàng nút không sát mép dưới.
      styles={{ footer: { padding: '16px 24px 24px' } }}
    >
      {products.isPending ? (
        <Skeleton active />
      ) : products.isError ? (
        <QueryError error={products.error} onRetry={products.refetch} />
      ) : !cart.length ? (
        // Giỏ trống: một nút về danh mục sản phẩm, đóng giỏ luôn (đang ở danh mục thì chỉ đóng, không tải lại).
        <Empty description="Giỏ hàng đang trống.">
          <Button
            type="primary"
            onClick={() => {
              onClose()
              navigate('/shop/drinks')
            }}
          >
            Xem sản phẩm
          </Button>
        </Empty>
      ) : (
        <ul className="af-shop-cart">
          {lines.map(({ productId, quantity, product }) => {
            const name = product?.name ?? `Sản phẩm ${productId}`
            // Sản phẩm đã bỏ khỏi danh mục thì không còn trang chi tiết để mở.
            const detail = product ? `/shop/products/${encodeURIComponent(productId)}` : undefined
            return (
              <li key={productId}>
                {detail ? (
                  // Ảnh và tên cùng dẫn tới một trang; ảnh bỏ khỏi thứ tự Tab để không phải qua hai lần.
                  <Link to={detail} onClick={onClose} tabIndex={-1} aria-hidden className="af-shop-cart-link">
                    <CartThumb product={product} />
                  </Link>
                ) : (
                  <CartThumb product={product} />
                )}
                <div className="af-shop-cart-body">
                  <div className="af-shop-cart-head">
                    {detail ? (
                      <Link to={detail} onClick={onClose} className="af-shop-cart-name" title="Xem chi tiết sản phẩm">
                        <strong>{name}</strong>
                      </Link>
                    ) : (
                      <strong>{name}</strong>
                    )}
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
      )}
    </Drawer>
  )
}
