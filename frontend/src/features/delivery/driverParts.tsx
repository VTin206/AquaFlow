import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'

/** Số tiền tài xế cần thu ở một điểm; đã đủ thì nói rõ thay vì "Thu 0 ₫". */
export function DriverDue({ due }: { due: number }) {
  if (due <= 0) return <span className="af-text-success">Đã thu đủ</span>
  return (
    <>
      Thu <Money value={due} tone={dueTone(due)} />
    </>
  )
}
