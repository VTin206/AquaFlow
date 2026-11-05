import type { ReactNode } from 'react'

/** Thanh dưới của hộp thoại có tiền: tổng bên trái luôn nhìn thấy, các nút bên phải. */
export function ModalTotalFooter({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="af-modal-footer">
      <div className="af-modal-total" role="status">
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      {children}
    </div>
  )
}
