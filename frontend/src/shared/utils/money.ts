/**
 * Màu tiền dùng chung toàn app:
 * - neutral: giá, tổng đơn (màu chữ thường)
 * - due: còn phải thu, công nợ (cam)
 * - paid: tiền đã thu vào (xanh lá)
 * - refund: tiền hoàn/chi ra, thiếu hụt, lỗ (đỏ, có dấu −)
 * - deposit: tiền cọc vỏ, không phải doanh thu (xanh dương)
 * Màu chỉ là tín hiệu phụ; nhãn đi kèm (Còn, Đã thu, Hoàn…) vẫn phải nói rõ ý nghĩa.
 */
export type MoneyTone = 'neutral' | 'due' | 'paid' | 'refund' | 'deposit'

/** Còn phải thu: cam khi còn nợ, xanh khi đã thu đủ. */
export const dueTone = (due: number): MoneyTone => (due > 0 ? 'due' : 'paid')
