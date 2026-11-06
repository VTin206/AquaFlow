import { useState } from 'react'
import { App, Avatar, Button, Card, DatePicker, Descriptions, Empty, Grid, Input, Modal, Segmented, Select, Skeleton, Switch, Tag } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  Boxes,
  Building2,
  CircleAlert,
  Download,
  RefreshCw,
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
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'
import { downloadCsv } from '@/shared/utils/csv'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { csvSafeCell } from './activityApi'
import { entityPages, groupByDay, initials, relativeTime, type ActivityItem, type ActivityRange } from './activityFeed'
import { useActivityFeed, type ActivityFilter } from './useActivityFeed'
import './activity.css'

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

/** Nhật ký hoạt động: một giao diện cho bản dùng thử và tài khoản thật, chỉ khác nguồn dữ liệu. */
export function ActivityPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  // Điện thoại không đủ chỗ cho 5 nút khoảng thời gian: dùng ô chọn.
  const narrow = Grid.useBreakpoint().md === false
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
  const feed = useActivityFeed(filter)
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
          [dayjs(item.at).format('DD/MM/YYYY HH:mm:ss'), item.actor, item.area, item.target, item.description, item.important ? 'Có' : ''].map(csvSafeCell),
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
      description="Ai đã làm gì, lúc nào trên đơn hàng, kho, giao hàng và tài khoản. Nhật ký chỉ ghi thêm, không sửa hoặc xóa được."
      actions={
        <>
          <Button icon={<RefreshCw size={16} />} loading={feed.refreshing} onClick={feed.refetch}>
            Làm mới
          </Button>
          <Button icon={<Download size={16} />} loading={exporting} disabled={!feed.total} onClick={() => void exportCsv()}>
            Xuất CSV
          </Button>
        </>
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        <div className="af-activity-toolbar">
          <div className="af-activity-row">
            {narrow ? (
              <Select<ActivityRange> aria-label="Khoảng thời gian" className="af-activity-range" value={range} onChange={setRange} options={ranges} />
            ) : (
              <Segmented<ActivityRange> aria-label="Khoảng thời gian" value={range} onChange={setRange} options={ranges} />
            )}
            {range === 'custom' && (
              <DatePicker.RangePicker
                aria-label="Chọn khoảng ngày"
                format="DD/MM/YYYY"
                value={custom}
                disabledDate={(date) => date.isAfter(dayjs(), 'day')}
                onChange={(value) => setCustom(value?.[0] && value[1] ? [value[0], value[1]] : null)}
              />
            )}
            <Input
              allowClear
              className="af-activity-search"
              prefix={<Search size={16} className="af-input-icon" />}
              placeholder="Tìm mã đơn, nội dung, người thực hiện..."
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
          <div className="af-activity-row">
            <div className="af-activity-areas" role="group" aria-label="Lọc khu vực">
              <Tag.CheckableTag checked={!area} onChange={() => setArea(undefined)}>
                Mọi khu vực
              </Tag.CheckableTag>
              {feed.areaOptions.map((option) => (
                <Tag.CheckableTag key={option.value} checked={area === option.value} onChange={(on) => setArea(on ? option.value : undefined)}>
                  {option.label}
                </Tag.CheckableTag>
              ))}
            </div>
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="Mọi người"
              aria-label="Lọc người thực hiện"
              value={actor}
              onChange={setActor}
              options={feed.actorOptions}
              className="af-activity-actor"
            />
            <label className="af-activity-important">
              <Switch size="small" checked={importantOnly} onChange={setImportantOnly} />
              Chỉ thao tác quan trọng
            </label>
          </div>
        </div>
        <div className="af-filter-summary">
          <span role="status">
            {feed.loading || feed.stale
              ? 'Đang tải nhật ký…'
              : importantOnly
                ? `${shown.length} thao tác quan trọng trong ${feed.items.length} dòng đã tải`
                : `${feed.items.length} / ${feed.total} hoạt động`}
            {feed.updatedAt > 0 && ` · cập nhật ${dayjs(feed.updatedAt).format('HH:mm')}`}
          </span>
          {hasFilters && (
            <Button type="link" size="small" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
          )}
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
            description={
              hasFilters
                ? 'Không có hoạt động phù hợp bộ lọc.'
                : `Không có hoạt động nào ${rangeText[range]}`.trim() + '.'
            }
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
                      <li key={item.id} className={item.important ? 'is-important' : undefined}>
                        <Avatar size={36} className="af-activity-avatar">
                          {initials(item.actor)}
                        </Avatar>
                        <div className="af-activity-main">
                          <p>
                            <strong>{item.actor}</strong> <span>{item.description}</span>
                          </p>
                          <div className="af-activity-meta">
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
                            {item.important && (
                              <Tag color="orange" icon={<CircleAlert size={12} aria-hidden />}>
                                Quan trọng
                              </Tag>
                            )}
                          </div>
                        </div>
                        <div className="af-activity-time">
                          <time dateTime={item.at} title={dayjs(item.at).format('DD/MM/YYYY HH:mm:ss')}>
                            {relativeTime(item.at)}
                          </time>
                          <ViewButton subject={`hoạt động lúc ${dayjs(item.at).format('HH:mm DD/MM')}`} onClick={() => setSelected(item)} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
            {feed.hasMore && (
              <Button block className="af-activity-more" loading={feed.loadingMore} onClick={feed.loadMore}>
                Xem thêm hoạt động cũ hơn
              </Button>
            )}
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
