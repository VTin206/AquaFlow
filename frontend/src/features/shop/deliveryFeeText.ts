import { currency } from '@/shared/utils/format'
import type { DeliveryFees } from '@/features/settings/types'

/** Cách tính phí cơ bản theo cài đặt cửa hàng, vd. "Dưới 3 sản phẩm: 15.000 ₫ · Từ 3 sản phẩm: miễn phí". */
export function baseFeeText({ freeFromUnits, smallOrderFee }: Pick<DeliveryFees, 'freeFromUnits' | 'smallOrderFee'>) {
  // Đơn nào cũng có ít nhất 1 sản phẩm nên ngưỡng 0 hoặc 1 nghĩa là luôn miễn phí.
  if (smallOrderFee <= 0 || freeFromUnits <= 1) return 'Miễn phí'
  return `Dưới ${freeFromUnits} sản phẩm: ${currency(smallOrderFee)} · Từ ${freeFromUnits} sản phẩm: miễn phí`
}

/**
 * Phụ thu thang bộ theo lầu, gộp các lầu liền nhau cùng mức; phần tử cuối áp dụng cho lầu đó trở lên (như BE).
 * Vd. [2000, 4000, 8000, 12000] → "Lầu 1: 2.000 ₫ · Lầu 2: 4.000 ₫ · Lầu 3: 8.000 ₫ · Từ lầu 4: 12.000 ₫ mỗi bình/thùng".
 */
export function stairsFeeText(stairsPerJug: readonly number[]) {
  if (!stairsPerJug.length || stairsPerJug.every((fee) => fee <= 0)) return 'Không tính phụ thu'
  const parts: string[] = []
  let start = 0
  stairsPerJug.forEach((fee, index) => {
    const last = index === stairsPerJug.length - 1
    if (!last && stairsPerJug[index + 1] === fee) return
    const from = start + 1
    const to = index + 1
    const floors = last ? `Từ lầu ${from}` : from === to ? `Lầu ${from}` : `Lầu ${from}–${to}`
    parts.push(`${floors}: ${fee > 0 ? currency(fee) : 'miễn phí'}`)
    start = index + 1
  })
  return `${parts.join(' · ')} mỗi bình/thùng. Chai, lon lẻ không tính.`
}
