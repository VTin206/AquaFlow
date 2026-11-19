import { useState } from 'react'
import { Button, Card, Empty, Input, Progress, Segmented, Select, Table } from 'antd'
import { Search } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { ViewButton } from '@/shared/components/ViewButton'
import { matchesSearch } from '@/shared/utils/search'
import { tablePagination } from '@/shared/utils/table'
import type { DeliveryTrip } from '../deliveryApi'
import { liveTripStatus, type TripViewStatus } from '../tripFocus'
import { inTripRange, tripGroupOf, type TripGroup, type TripRange as Range } from '../tripGroups'
import { TripStatusTag } from './TripStatusTag'

// Cùng thứ tự với các tab: theo đường đi của một chuyến.
const statusRank: Record<TripViewStatus, number> = { 'Chờ xuất phát': 0, 'Đang giao': 1, 'Chờ đối soát': 2, 'Đã đối soát': 3, 'Đã hủy': 4 }
const shortTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

type TripsListProps = {
  trips: DeliveryTrip[]
  loading: boolean
  dueLabel: (trip: DeliveryTrip) => string
  onOpen: (id: number) => void
}

/** Danh sách chuyến dạng dòng: nhóm theo việc cần làm, tìm theo số chuyến/tài xế/xe, lọc theo ngày. */
export function TripsList({ trips, loading, dueLabel, onOpen }: TripsListProps) {
  const [chosenGroup, setGroup] = useState<TripGroup | null>(null)
  const [range, setRange] = useState<Range>('7')
  const [search, setSearch] = useState('')

  const inRange = trips.filter((trip) => inTripRange(trip, range))
  const count = (group: TripGroup) =>
    group === 'all' ? inRange.length : inRange.filter((trip) => tripGroupOf(liveTripStatus(trip)) === group).length
  // "Tất cả" đứng đầu và mở sẵn; số trên từng tab cho biết còn bao nhiêu chuyến cần làm.
  const group: TripGroup = chosenGroup ?? 'all'
  const visible = inRange
    .filter((trip) => group === 'all' || tripGroupOf(liveTripStatus(trip)) === group)
    .filter((trip) => matchesSearch(search, `#${trip.id} ${trip.id} ${trip.driverName ?? ''} ${trip.vehicle ?? ''}`))
    .sort((a, b) => statusRank[liveTripStatus(a)] - statusRank[liveTripStatus(b)] || b.id - a.id)

  return (
    <Card className="af-card" styles={{ body: { padding: 0 } }}>
      <div className="af-toolbar">
        <Segmented<TripGroup>
          aria-label="Nhóm chuyến"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: <CountLabel label="Tất cả" count={count('all')} /> },
            { value: 'waiting', label: <CountLabel label="Chờ xuất phát" count={count('waiting')} tone="warning" /> },
            { value: 'running', label: <CountLabel label="Đang giao" count={count('running')} tone="info" /> },
            { value: 'settle', label: <CountLabel label="Chờ đối soát" count={count('settle')} urgent tone="warning" /> },
            { value: 'done', label: <CountLabel label="Đã xong" count={count('done')} tone="success" /> },
          ]}
        />
        <div className="af-trips-filters">
          <Input
            allowClear
            aria-label="Tìm chuyến"
            prefix={<Search size={16} className="af-input-icon" />}
            placeholder="Số chuyến, tài xế, xe"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select<Range>
            aria-label="Khoảng ngày của chuyến đã xong"
            value={range}
            // Lọc nhỏ nên xóa ngay trong ô: bấm × quay về mặc định 7 ngày.
            allowClear={range !== '7'}
            onChange={(next) => setRange(next ?? '7')}
            options={[
              { value: 'today', label: 'Hôm nay' },
              { value: '7', label: '7 ngày qua' },
              { value: '30', label: '30 ngày qua' },
              { value: 'all', label: 'Tất cả' },
            ]}
          />
        </div>
      </div>
      <Table<DeliveryTrip>
        className="af-data-table af-table-flush af-table-dense"
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={visible}
        pagination={{ ...tablePagination, hideOnSinglePage: true }}
        rowClassName="af-row-clickable"
        onRow={(trip) => ({
          onClick: (event) => {
            if (event.target instanceof Element && event.target.closest('button, a')) return
            onOpen(trip.id)
          },
        })}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={trips.length ? 'Không có chuyến phù hợp.' : 'Chưa có chuyến nào.'} />
          ),
        }}
        columns={[
          {
            title: 'Chuyến',
            key: 'trip',
            width: 190,
            render: (_, trip) => (
              <span className="af-nowrap">
                <span className="af-strong">Chuyến #{trip.id}</span> <small className="af-text-muted">{shortTime(trip.createdAt)}</small>
              </span>
            ),
          },
          {
            title: 'Tài xế',
            key: 'driver',
            ellipsis: true,
            render: (_, trip) => (
              <>
                {trip.driverName ?? 'Chưa phân tài xế'}
                {trip.vehicle && <small className="af-text-muted"> · {trip.vehicle}</small>}
              </>
            ),
          },
          {
            title: 'Tiến độ',
            key: 'progress',
            width: 130,
            render: (_, trip) => {
              const finished = trip.orders.filter((stop) => stop.latestAttempt).length
              const total = trip.orders.length
              return (
                <Progress
                  className="af-trip-progress-cell"
                  percent={Math.round((finished / Math.max(1, total)) * 100)}
                  size="small"
                  format={() => `${finished}/${total}`}
                />
              )
            },
          },
          { title: 'Cần thu', key: 'due', width: 130, align: 'right', render: (_, trip) => dueLabel(trip).replace(/^Cần thu /, '') },
          { title: 'Trạng thái', key: 'status', width: 130, render: (_, trip) => <TripStatusTag status={liveTripStatus(trip)} /> },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 110,
            render: (_, trip) =>
              liveTripStatus(trip) === 'Chờ đối soát' ? (
                <Button size="small" type="primary" onClick={() => onOpen(trip.id)}>
                  Đối soát
                </Button>
              ) : (
                <ViewButton subject={`chuyến #${trip.id}`} onClick={() => onOpen(trip.id)} />
              ),
          },
        ]}
      />
    </Card>
  )
}
