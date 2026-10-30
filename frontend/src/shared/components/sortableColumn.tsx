import { Tooltip, type TableColumnType } from 'antd'
import { ArrowDown10, ArrowDownZA, ArrowUp01, ArrowUpAZ, ArrowUpDown, ClockArrowDown, ClockArrowUp, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

type SortKind = 'text' | 'number' | 'time' | 'stockRatio'
type Order = 'ascend' | 'descend'
type SortState = { key: string; order: Order } | null

const labels: Record<SortKind, [string, string]> = {
  text: ['A → Z', 'Z → A'],
  number: ['Thấp → Cao', 'Cao → Thấp'],
  time: ['Sớm → Muộn', 'Muộn → Sớm'],
  stockRatio: ['Tỷ lệ tồn: thấp → cao', 'Tỷ lệ tồn: cao → thấp'],
}

/** Icon cho từng chiều sắp xếp: tăng dần mũi tên lên, giảm dần mũi tên xuống, kèm ký hiệu theo loại dữ liệu. */
const icons: Record<SortKind, [LucideIcon, LucideIcon]> = {
  text: [ArrowUpAZ, ArrowDownZA],
  number: [ArrowUp01, ArrowDown10],
  time: [ClockArrowUp, ClockArrowDown],
  stockRatio: [ArrowUp01, ArrowDown10],
}

/** Mỗi lần bấm: tăng dần → giảm dần → bỏ sắp xếp. */
const nextOrder = (order: Order | null): Order | null => (order === null ? 'ascend' : order === 'ascend' ? 'descend' : null)

type SortableProps<T> = Pick<TableColumnType<T>, 'key' | 'title' | 'sortOrder' | 'sortIcon' | 'sortDirections' | 'showSorterTooltip'>

/**
 * Sắp xếp bằng cách bấm tiêu đề cột, xoay vòng tăng → giảm → bỏ; icon cho biết chiều hiện tại theo loại dữ liệu.
 * `sortOrder` được điều khiển ở đây nên cú bấm vào ô tiêu đề của AntD không đổi thứ tự.
 */
export function useColumnSort<T>(initial: SortState = null) {
  const [sort, setSort] = useState<SortState>(initial)

  const column = (label: string, key: string, kind: SortKind): SortableProps<T> => {
    const order = sort?.key === key ? sort.order : null
    const [ascLabel, descLabel] = labels[kind]
    const [AscIcon, DescIcon] = icons[kind]
    const Icon = order === 'ascend' ? AscIcon : order === 'descend' ? DescIcon : ArrowUpDown
    const textOf = (value: Order | null) => (value === 'ascend' ? ascLabel : value === 'descend' ? descLabel : 'Bỏ sắp xếp')
    const next = nextOrder(order)

    return {
      key,
      sortOrder: order,
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      sortIcon: () => null,
      title: (
        <Tooltip title={`Bấm để ${next ? `sắp xếp ${textOf(next)}` : 'bỏ sắp xếp'}`} mouseEnterDelay={0.4}>
          <button
            type="button"
            className={`af-sort-trigger${order ? ' is-active' : ''}`}
            aria-label={`${label}: ${order ? textOf(order) : 'chưa sắp xếp'}. Bấm để ${next ? textOf(next) : 'bỏ sắp xếp'}`}
            onClick={(event) => {
              event.stopPropagation()
              setSort(next ? { key, order: next } : null)
            }}
          >
            {label}
            <Icon size={14} aria-hidden className="af-sort-icon" />
          </button>
        </Tooltip>
      ),
    }
  }

  return { column }
}
