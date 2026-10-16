import { Dropdown, type TableColumnType } from 'antd'
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from 'lucide-react'
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
    const check = (value: Order | 'none') => ((order ?? 'none') === value ? <Check size={14} aria-hidden /> : <span className="af-sort-check-space" />)

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
              { key: 'ascend', label: ascLabel, icon: check('ascend') },
              { key: 'descend', label: descLabel, icon: check('descend') },
              { type: 'divider' },
              { key: 'none', label: 'Bỏ sắp xếp', icon: check('none'), disabled: !order },
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
