import { useState } from 'react'
import { Droplets } from 'lucide-react'
import type { ShopProduct } from '../shopService'

/** Ảnh nhỏ của sản phẩm trong giỏ và trang thanh toán; lỗi ảnh thì hiện biểu tượng giọt nước. */
export function CartThumb({ product }: { product?: ShopProduct }) {
  const [failed, setFailed] = useState(false)
  return <span className="af-shop-cart-thumb">
    {product?.image && !failed ? <img src={product.image} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Droplets size={22} strokeWidth={1.5} aria-hidden />}
  </span>
}
