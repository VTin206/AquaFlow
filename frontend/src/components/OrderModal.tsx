import { type FormEvent, useState } from 'react'
import { Plus, ShoppingCart } from 'lucide-react'
import type { OrderDraft, Product } from '../types'
import { currency } from '../utils/format'
import { Modal } from './Modal'

const emptyOrder: OrderDraft = { customer: '', product: 'Nước tinh khiết bình 20L', quantity: 1 }

type OrderModalProps = { products: Product[]; submitting?: boolean; onSubmit: (draft: OrderDraft) => void; onClose: () => void }

export function OrderModal({ products, submitting = false, onSubmit, onClose }: OrderModalProps) {
  const [form, setForm] = useState(emptyOrder)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <Modal titleId="modal-title" eyebrow="BÁN HÀNG" title="Tạo đơn hàng mới" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Tên khách hàng
          <input required autoFocus placeholder="Ví dụ: Nguyễn Văn An" value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} />
        </label>
        <label>
          Sản phẩm
          <select value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })}>
            {products
              .filter((product) => product.id !== 'P-002')
              .map((product) => (
                <option key={product.id} value={product.name}>
                  {product.name} · {currency(product.price)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Số lượng
          <input type="number" min="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Math.max(1, Number(event.target.value)) })} />
        </label>
        <div className="modal-note">
          <ShoppingCart size={16} /> Đơn mới sẽ ở trạng thái Chờ xác nhận và giữ số lượng tương ứng trong kho.
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <Plus size={16} /> {submitting ? 'Đang tạo...' : 'Tạo đơn'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
