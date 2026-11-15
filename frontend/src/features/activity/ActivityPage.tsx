import { useState } from 'react'
import { filterOn } from '@/shared/utils/filterOn'
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Switch,
  Tag,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  Boxes,
  Building2,
  Download,
  FunnelX,
  Search,
  Settings2,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { modalWidth } from '@/shared/utils/modal'
import { downloadCsv } from '@/shared/utils/csv'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { csvSafeCell } from './activityApi'
import { entityPages, groupByDay, type ActivityItem, type ActivityRange } from './activityFeed'
import { ACTIVITY_PAGE_SIZE, useActivityFeed, type ActivityFilter } from './useActivityFeed'
import './activity.css'
import { PeriodPicker } from '@/shared/components/PeriodPicker'

const areaIcons: Record<string, LucideIcon> = {
  'Đơn hàng': ShoppingBag,
  'Thanh toán': Wallet,
  'Kho hàng': Boxes,
  'Giao hàng': Truck,
  'Khách hàng': Users,
  'Nhà cung cấp': Building2,
  'Cài đặt': Settings2,
}
const ranges: { value: ActivityRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
  { value: 'custom', label: 'Chọn ngày' },
]
const rangeText: Record<ActivityRange, string> = {
  today: 'hôm nay',
  '7d': 'trong 7 ngày qua',
  '30d': 'trong 30 ngày qua',
  all: '',
  custom: 'trong khoảng ngày đã chọn',
}

/** Nhật ký hoạt động của cửa hàng. */
export function ActivityPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  // Điện thoại không đủ chỗ cho 5 nút khoảng thời gian: dùng ô chọn.
  const [range, setRange] = useState<ActivityRange>('7d')
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null)
  const [area, setArea] = useState<string>()
  const [actor, setActor] = useState<string>()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [selected, setSelected] = useState<ActivityItem | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const filter: ActivityFilter = { range, custom, area, actor, q }
  // Đổi bộ lọc thì về trang đầu.
  const filterKey = JSON.stringify(filter)
  const [paging, setPaging] = useState({ filterKey, page: 0 })
  const page = paging.filterKey === filterKey ? paging.page : 0
  const feed = useActivityFeed(filter, page)
  const shown = importantOnly ? feed.items.filter((item) => item.important) : feed.items
  const groups = groupByDay(shown)
  const hasFilters = Boolean(area || actor || q || importantOnly)

  const openEntity = (item: ActivityItem) => {
    if (!item.entity) return
    if (item.entity.type === 'ORDER') setOrderId(item.entity.id)
    else if (entityPages[item.entity.type]) navigate(entityPages[item.entity.type].path)
  }
  const canOpen = (item: ActivityItem) => Boolean(item.entity && (item.entity.type === 'ORDER' || entityPages[item.entity.type]))
  const exportCsv = async () => {
    setExporting(true)
    try {
      const { items, truncated } = await feed.exportAll()
      const rows = importantOnly ? items.filter((item) => item.important) : items
      downloadCsv(`nhat-ky-${dayjs().format('YYYY-MM-DD')}.csv`, [
        ['Thời điểm', 'Người thực hiện', 'Khu vực', 'Đối tượng', 'Nội dung', 'Quan trọng'],
        ...rows.map((item) =>
          [
            dayjs(item.at).format('DD/MM/YYYY HH:mm:ss'),
            item.actor,
            item.area,
            item.target,
            item.description,
            item.important ? 'Có' : '',
          ].map(csvSafeCell),
        ),
      ])
      message.success(truncated ? `Đã xuất 5.000 dòng mới nhất. Thu hẹp khoảng ngày để xuất phần còn lại.` : `Đã xuất ${rows.length} dòng.`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không xuất được nhật ký.')
    } finally {
      setExporting(false)
    }
  }
  const clearFilters = () => {
    setArea(undefined)
    setActor(undefined)
    setSearch('')
    setQ('')
    setImportantOnly(false)
  }

  return (
    <Page
      title="Nhật ký hoạt động"
      actions={
        <>
          <Button icon={<Download size={16} />} loading={exporting} disabled={!feed.total} onClick={() => void exportCsv()}>
            Xuất CSV
          </Button>
        </>
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {/* Một hàng lọc: kỳ, khu vực, người, quan trọng, xóa lọc; số dòng đứng cạnh ô tìm. */}
        <div className="af-activity-toolbar">
          <Select<ActivityRange>
            aria-label="Khoảng thời gian"
            className="af-activity-range"
            value={range}
            onChange={setRange}
            options={ranges}
          />
          {range === 'custom' && (
            <PeriodPicker
              aria-label="Chọn khoảng ngày"
              value={custom}
              onChange={(value) => setCustom(value?.[0] && value[1] ? [value[0], value[1]] : null)}
            />
          )}
          <Select
            allowClear
            placeholder="Mọi khu vực"
            aria-label="Lọc khu vực"
            value={area}
            onChange={setArea}
            options={feed.areaOptions}
            className={`af-activity-area-select ${filterOn(Boolean(area))}`}
          />
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Mọi người"
            aria-label="Lọc người thực hiện"
            value={actor}
            onChange={setActor}
            options={feed.actorOptions}
            className={`af-activity-actor ${filterOn(Boolean(actor))}`}
          />
          <label className="af-activity-important">
            <Switch size="small" checked={importantOnly} onChange={setImportantOnly} />
            Quan trọng
          </label>
          {hasFilters && (
            <Button type="link" className="af-clear-filter" icon={<FunnelX size={15} />} onClick={clearFilters}>
              Xóa lọc
            </Button>
          )}
          <div className="af-activity-end">
            <span role="status" className="af-activity-count">
              {feed.loading || feed.stale
                ? 'Đang tải…'
                : importantOnly
                  ? `${shown.length} quan trọng`
                  : `${feed.total} dòng`}
            </span>
            <Input
              allowClear
              className="af-activity-search"
              prefix={<Search size={16} className="af-input-icon" />}
              placeholder="Tìm mã đơn, nội dung, người…"
              aria-label="Tìm nhật ký"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                if (!event.target.value) setQ('')
              }}
              onPressEnter={() => setQ(search.trim())}
              onBlur={() => setQ(search.trim())}
            />
          </div>
        </div>
        {feed.error ? (
          <QueryError error={feed.error} onRetry={feed.refetch} />
        ) : feed.loading ? (
          <div className="af-activity-body">
            <Skeleton active avatar paragraph={{ rows: 6 }} />
          </div>
        ) : !groups.length ? (
          <Empty
            className="af-activity-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={hasFilters ? 'Không có hoạt động phù hợp bộ lọc.' : `Không có hoạt động nào ${rangeText[range]}`.trim() + '.'}
          >
            {range !== 'all' && !hasFilters && <Button onClick={() => setRange('all')}>Xem tất cả</Button>}
          </Empty>
        ) : (
          <div className={`af-activity-body${feed.stale ? ' is-stale' : ''}`} aria-busy={feed.stale}>
            {groups.map((group) => (
              <section key={group.key} className="af-activity-day" aria-label={group.label}>
                <h3>
                  {group.label} <span>{group.items.length} hoạt động</span>
                </h3>
                <ol>
                  {group.items.map((item) => {
                    const Icon = areaIcons[item.area]
                    return (
                      // Một dòng: giờ · người · việc · đối tượng · khu vực; bấm dòng để xem chi tiết.
                      <li
                        key={item.id}
                        className={item.important ? 'is-important' : undefined}
                        tabIndex={0}
                        aria-label={`Xem chi tiết: ${item.actor} ${item.description}`}
                        onClick={(event) => {
                          if (event.target instanceof Element && event.target.closest('button, a')) return
                          setSelected(item)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setSelected(item)
                        }}
                      >
                        <time dateTime={item.at} title={dayjs(item.at).format('DD/MM/YYYY HH:mm:ss')}>
                          {dayjs(item.at).format('HH:mm')}
                        </time>
                        <strong className="af-activity-who">{item.actor}</strong>
                        <span className="af-activity-what">{item.description}</span>
                        {canOpen(item) ? (
                          <Button type="link" size="small" className="af-activity-target" onClick={() => openEntity(item)}>
                            {item.target}
                          </Button>
                        ) : (
                          <span className="af-activity-target">{item.target}</span>
                        )}
                        <Tag className="af-activity-area" icon={Icon ? <Icon size={12} aria-hidden /> : undefined}>
                          {item.area}
                        </Tag>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
            <Pagination
              className="af-activity-pager"
              current={page + 1}
              pageSize={ACTIVITY_PAGE_SIZE}
              total={feed.total}
              showSizeChanger={false}
              hideOnSinglePage
              showTotal={(total, range) => `${range[0]}–${range[1]} / ${total} dòng`}
              onChange={(next) => setPaging({ filterKey, page: next - 1 })}
            />
          </div>
        )}
      </Card>
      <Modal
        open={selected !== null}
        centered
        onCancel={() => setSelected(null)}
        title="Chi tiết hoạt động"
        width={modalWidth.small}
        footer={
          <>
            <Button onClick={() => setSelected(null)}>Đóng</Button>
            {selected && canOpen(selected) && (
              <Button
                type="primary"
                onClick={() => {
                  openEntity(selected)
                  setSelected(null)
                }}
              >
                {selected.entity?.type === 'ORDER' ? 'Mở đơn hàng' : entityPages[selected.entity!.type].label}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <>
            <Descriptions
              column={1}
              size="small"
              items={[
                { key: 'at', label: 'Thời điểm', children: dayjs(selected.at).format('DD/MM/YYYY HH:mm:ss') },
                { key: 'actor', label: 'Người thực hiện', children: selected.actor },
                { key: 'area', label: 'Khu vực', children: selected.area },
                { key: 'target', label: 'Đối tượng', children: selected.target },
                { key: 'what', label: 'Nội dung', children: selected.description },
                ...(selected.important ? [{ key: 'important', label: 'Mức độ', children: <Tag color="orange">Quan trọng</Tag> }] : []),
              ]}
            />
            <p className="af-form-hint">Nhật ký chưa ghi lại giá trị trước và sau khi sửa.</p>
          </>
        )}
      </Modal>
      {orderId && <OrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </Page>
  )
}
