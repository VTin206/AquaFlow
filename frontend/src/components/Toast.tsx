import { Check, X } from 'lucide-react'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast">
      <span className="toast-icon">
        <Check size={15} />
      </span>
      {message}
      <button aria-label="Đóng thông báo" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  )
}
