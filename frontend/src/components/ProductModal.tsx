import { type ChangeEvent, type FormEvent, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import type { ProductDraft } from '../types'
import { Modal } from './Modal'
import type { ToastTone } from './Toast'

const emptyProduct: ProductDraft = { name: '', brand: '', sku: '', unit: 'Bình', price: 0, stock: 0, image: '' }

type ProductModalProps = {
  submitting?: boolean
  onSubmit: (draft: ProductDraft) => void
  onClose: () => void
  onNotice: (message: string, tone?: ToastTone) => void
}

export function ProductModal({ submitting = false, onSubmit, onClose, onNotice }: ProductModalProps) {
  const [form, setForm] = useState(emptyProduct)

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onNotice('Vui lòng chọn một tệp hình ảnh.', 'error')
      event.currentTarget.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotice('Ảnh cần có dung lượng dưới 5 MB.', 'error')
      event.currentTarget.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm((current) => ({ ...current, image: typeof reader.result === 'string' ? reader.result : '' }))
    reader.readAsDataURL(file)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <Modal titleId="product-modal-title" eyebrow="DANH MỤC HÀNG HÓA" title="Thêm sản phẩm" className="product-modal" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="upload-label">
          Ảnh sản phẩm
          <div className={`image-upload ${form.image ? 'has-image' : ''}`}>
            {form.image ? (
              <img src={form.image} alt="Ảnh xem trước sản phẩm" />
            ) : (
              <span className="image-upload-empty">
                <ImagePlus size={22} />
                <strong>Chọn ảnh sản phẩm</strong>
                <small>PNG, JPG hoặc WEBP · tối đa 5 MB</small>
              </span>
            )}
            <input type="file" accept="image/*" onChange={selectImage} />
          </div>
        </label>
        <div className="product-form-grid">
          <label>
            Tên sản phẩm
            <input required autoFocus placeholder="Ví dụ: Nước tinh khiết bình 20L" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Mã sản phẩm
            <input required placeholder="Ví dụ: AQUA-20L" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
          </label>
          <label>
            Thương hiệu
            <input placeholder="Ví dụ: AquaFlow" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
          </label>
          <label>
            Đơn vị
            <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
              <option>Bình</option>
              <option>Thùng</option>
              <option>Chai</option>
              <option>Vỏ</option>
            </select>
          </label>
          <label>
            Giá bán (₫)
            <input type="number" min="0" required value={form.price} onChange={(event) => setForm({ ...form, price: Math.max(0, Number(event.target.value)) })} />
          </label>
          <label>
            Số lượng tồn
            <input type="number" min="0" required value={form.stock} onChange={(event) => setForm({ ...form, stock: Math.max(0, Number(event.target.value)) })} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <Plus size={16} /> {submitting ? 'Đang lưu...' : 'Lưu sản phẩm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
