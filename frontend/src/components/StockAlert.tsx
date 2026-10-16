import { Droplets } from 'lucide-react'
import type { Product } from '../types'

export function StockAlert({ product }: { product: Product }) {
  const percent = Math.min(100, (product.stock / (product.threshold * 2)) * 100)
  const level = product.stock <= product.threshold * 0.7 ? 'danger' : 'caution'
  return (
    <div className="stock-alert">
      <div className="product-symbol">
        <Droplets size={17} />
      </div>
      <div className="stock-alert-copy">
        <div className="stock-alert-title">
          <div>
            <strong>{product.name}</strong>
            <small>{product.sku}</small>
          </div>
          <b className={level}>
            {product.stock} {product.unit.toLowerCase()}
          </b>
        </div>
        <div className="progress-track">
          <i className={level} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  )
}
