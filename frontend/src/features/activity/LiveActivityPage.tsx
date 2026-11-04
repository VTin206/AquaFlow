import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, DatePicker, Descriptions, Input, Modal, Select, Space, Table, Tag } from 'antd'
import type { Dayjs } from 'dayjs'
import { Download, RefreshCw } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { downloadCsv } from '@/shared/utils/csv'
import { activityApi, activityAreas, activityDescription, activityTarget, csvSafeCell, type ActivityAreaCode, type ActivityLog } from './activityApi'

export function LiveActivityPage() {
  const [area, setArea] = useState<ActivityAreaCode>()
  const [actorId, setActorId] = useState<number>()
  const [dates, setDates] = useState<[Dayjs, Dayjs] | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const filter = { area, actorId, q, page, size, from: dates?.[0].startOf('day').toISOString(), to: dates?.[1].add(1, 'day').startOf('day').toISOString() }
  const logs = useQuery({ queryKey: ['live', 'activity', filter], queryFn: () => activityApi.list(filter), refetchInterval: 15000 })
  const actors = useQuery({ queryKey: ['live', 'activity', 'actors'], queryFn: activityApi.actors, refetchInterval: 30000 })
  const detail = useQuery({ queryKey: ['live', 'activity', 'detail', selectedId], queryFn: () => activityApi.detail(selectedId!), enabled: selectedId !== null })
  const rows = logs.data?.content ?? []
  const columns = [
    { title: 'Thời điểm', dataIndex: 'at', width: 180, render: (at: string) => new Date(at).toLocaleString('vi-VN') },
    { title: 'Người thực hiện', dataIndex: 'actorName', width: 200 },
    { title: 'Khu vực', dataIndex: 'area', width: 140, render: (value: ActivityAreaCode) => <Tag>{activityAreas[value] ?? value}</Tag> },
    { title: 'Đối tượng', width: 180, render: (_: unknown, entry: ActivityLog) => activityTarget(entry) },
    { title: 'Nội dung', render: (_: unknown, entry: ActivityLog) => activityDescription(entry) },
    { title: 'Thao tác', width: 100, render: (_: unknown, entry: ActivityLog) => <Button type="link" onClick={() => setSelectedId(entry.id)}>Chi tiết</Button> },
  ]
  return <Page title="Nhật ký hoạt động" description="Theo dõi thao tác thành công trên hệ thống. Nhật ký chỉ đọc, không sửa hoặc xóa."
    actions={<Space><Button icon={<RefreshCw size={16} />} loading={logs.isFetching} onClick={() => { void logs.refetch(); void actors.refetch() }}>Làm mới</Button>
      <Button icon={<Download size={16} />} disabled={!rows.length || logs.isError} onClick={() => downloadCsv('nhat-ky-trang-hien-tai.csv', [
        ['Thời điểm', 'Người thực hiện', 'Khu vực', 'Đối tượng', 'Nội dung'],
        ...rows.map(entry => [new Date(entry.at).toLocaleString('vi-VN'), entry.actorName, activityAreas[entry.area], activityTarget(entry), activityDescription(entry)].map(csvSafeCell)),
      ])}>Xuất CSV trang này</Button></Space>}>
    <Card className="af-card" styles={{ body: { padding: 0 } }}>
      <div className="af-toolbar"><Space wrap>
        <Select allowClear placeholder="Mọi khu vực" aria-label="Lọc khu vực" value={area} style={{ width: 170 }}
          options={Object.entries(activityAreas).map(([value, label]) => ({ value, label }))} onChange={value => { setArea(value); setPage(0) }} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Mọi người" aria-label="Lọc người thực hiện" value={actorId} style={{ width: 220 }} loading={actors.isPending}
          options={actors.data?.map(actor => ({ value: actor.id, label: `${actor.name} (#${actor.id})` }))} onChange={value => { setActorId(value); setPage(0) }} />
        <DatePicker.RangePicker format="DD/MM/YYYY" value={dates} onChange={value => { setDates(value?.[0] && value[1] ? [value[0], value[1]] : null); setPage(0) }} />
        <Input.Search allowClear maxLength={200} placeholder="Tìm mã đơn, nội dung, người thực hiện..." aria-label="Tìm nhật ký" style={{ width: 300 }} onSearch={value => { setQ(value); setPage(0) }} />
      </Space></div>
      {actors.isError && <QueryError error={actors.error} onRetry={actors.refetch} />}
      {logs.isError ? <QueryError error={logs.error} onRetry={logs.refetch} /> : <Table<ActivityLog> rowKey="id" className="af-data-table af-table-flush"
        dataSource={rows} columns={columns} loading={logs.isPending} scroll={{ x: 1100 }}
        locale={{ emptyText: 'Không có nhật ký phù hợp.' }}
        pagination={{ current: page + 1, pageSize: size, total: logs.data?.totalElements ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
          onChange: (next, nextSize) => { setPage(nextSize === size ? next - 1 : 0); setSize(nextSize) } }} />}
    </Card>
    <Modal open={selectedId !== null} title={`Nhật ký #${selectedId ?? ''}`} footer={null} onCancel={() => setSelectedId(null)} loading={detail.isPending}>
      {detail.isError ? <QueryError error={detail.error} onRetry={detail.refetch} /> : detail.data && <Descriptions column={1} items={[
        { key: 'at', label: 'Thời điểm', children: new Date(detail.data.at).toLocaleString('vi-VN') },
        { key: 'by', label: 'Người thực hiện', children: detail.data.actorName },
        { key: 'area', label: 'Khu vực', children: activityAreas[detail.data.area] },
        { key: 'target', label: 'Đối tượng', children: activityTarget(detail.data) },
        { key: 'action', label: 'Nội dung', children: activityDescription(detail.data) },
      ]} />}
    </Modal>
  </Page>
}
