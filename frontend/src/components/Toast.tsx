import { AlertTriangle, Check, X } from 'lucide-react'

export type ToastTone = 'success' | 'error'

type ToastProps = { message: string; tone?: ToastTone; onClose: () => void }

export function Toast({ message, tone = 'success', onClose }: ToastProps) {
  return (
    <div className={`toast ${tone === 'error' ? 'toast-error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon">{tone === 'error' ? <AlertTriangle size={13} /> : <Check size={15} />}</span>
      {message}
      <button aria-label="Đóng thông báo" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  )
}
