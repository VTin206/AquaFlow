import { type FormEvent, useState } from 'react'
import { Check, PackagePlus } from 'lucide-react'
import type { Product, StockDraft } from '../types'
import { Modal } from './Modal'

type StockModalProps = { products: Product[]; submitting?: boolean; onSubmit: (draft: StockDraft) => void; onClose: () => void }

export function StockModal({ products, submitting = false, onSubmit, onClose }: StockModalProps) {
  const [form, setForm] = useState<StockDraft>({ productId: 'P-001', quantity: 1 })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <Modal titleId="modal-title" eyebrow="QUẢN LÝ KHO" title="Tạo phiếu nhập kho" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Sản phẩm nhập
          <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số lượng thực nhận
          <input type="number" min="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Math.max(1, Number(event.target.value)) })} />
        </label>
        <div className="modal-note">
          <PackagePlus size={16} /> Số lượng tồn sẽ được cập nhật sau khi xác nhận phiếu nhập.
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <Check size={16} /> {submitting ? 'Đang lưu...' : 'Xác nhận nhập'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
