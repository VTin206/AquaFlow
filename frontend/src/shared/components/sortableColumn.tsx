import { Dropdown, type TableColumnType } from 'antd'
import { ArrowDown, ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, ArrowUp, ArrowUpDown, Check, ClockArrowDown, ClockArrowUp, ListX, type LucideIcon } from 'lucide-react'
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

/** Icon cho từng chiều sắp xếp, theo loại dữ liệu của cột. */
const icons: Record<SortKind, [LucideIcon, LucideIcon]> = {
  text: [ArrowDownAZ, ArrowDownZA],
  number: [ArrowDown01, ArrowDown10],
  time: [ClockArrowUp, ClockArrowDown],
  stockRatio: [ArrowDown01, ArrowDown10],
}

type SortableProps<T> = Pick<TableColumnType<T>, 'key' | 'title' | 'sortOrder' | 'sortIcon' | 'sortDirections' | 'showSorterTooltip'>

/**
 * Sắp xếp bằng menu trên tiêu đề cột: người dùng chọn rõ chiều thay vì bấm xoay vòng.
 * `sortOrder` được điều khiển ở đây nên cú bấm vào ô tiêu đề của AntD không đổi thứ tự.
 */
export function useColumnSort<T>(initial: SortState = null) {
  const [sort, setSort] = useState<SortState>(initial)

  const column = (label: string, key: string, kind: SortKind): SortableProps<T> => {
    const order = sort?.key === key ? sort.order : null
    const Icon = order === 'ascend' ? ArrowUp : order === 'descend' ? ArrowDown : ArrowUpDown
    const [ascLabel, descLabel] = labels[kind]
    const [AscIcon, DescIcon] = icons[kind]
    // Icon bên trái cho biết kiểu sắp xếp; dấu ✓ bên phải đánh dấu lựa chọn hiện tại.
    const item = (value: Order | 'none', text: string, ItemIcon: LucideIcon) => ({
      key: value,
      icon: <ItemIcon size={15} aria-hidden />,
      label: <span className="af-sort-option">{text}{(order ?? 'none') === value && <Check size={14} aria-hidden />}</span>,
    })

    return {
      key,
      sortOrder: order,
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      sortIcon: () => null,
      title: (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              item('ascend', ascLabel, AscIcon),
              item('descend', descLabel, DescIcon),
              { type: 'divider' },
              { ...item('none', 'Bỏ sắp xếp', ListX), disabled: !order },
            ],
            onClick: ({ key: value, domEvent }) => {
              domEvent.stopPropagation()
              setSort(value === 'none' ? null : { key, order: value as Order })
            },
          }}
        >
          <button
            type="button"
            className={`af-sort-trigger${order ? ' is-active' : ''}`}
            aria-label={`${label}: ${order ? (order === 'ascend' ? ascLabel : descLabel) : 'chưa sắp xếp'}. Mở tùy chọn sắp xếp`}
            onClick={(event) => event.stopPropagation()}
          >
            {label}
            <Icon size={14} aria-hidden className="af-sort-icon" />
          </button>
        </Dropdown>
      ),
    }
  }

  return { column }
}
