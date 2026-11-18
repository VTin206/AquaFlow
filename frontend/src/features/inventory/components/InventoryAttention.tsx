import { Button } from 'antd'

export type AttentionItem = {
  key: string
  /** danger: phải xử lý ngay; warning: nên xử lý sớm; info: việc đang dở. */
  tone: 'danger' | 'warning' | 'info'
  text: string
  action: { label: string; onClick: () => void }
}

/**
 * Việc kho cần làm, mỗi vấn đề một dòng kèm nút làm ngay, xếp theo mức gấp.
 * Không còn việc gì thì không hiện, số đếm chi tiết đã có ở bộ lọc của bảng.
 */
export function InventoryAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) return null
  return (
    <section className="af-attention" aria-label="Việc kho cần xử lý">
      <h2>Cần xử lý</h2>
      <ul>
        {items.map((item) => (
          <li key={item.key} className={`is-${item.tone}`}>
            <span className="af-attention-dot" aria-hidden />
            <span className="af-attention-text">{item.text}</span>
            <Button size="small" onClick={item.action.onClick}>
              {item.action.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
