import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Dayjs } from 'dayjs'
import { activityApi, activityAreas, type ActivityAreaCode } from './activityApi'
import { fromLive, rangeBounds, type ActivityItem, type ActivityRange } from './activityFeed'

/** Mỗi trang 10 dòng như các trang danh sách khác. */
export const ACTIVITY_PAGE_SIZE = 10
const EXPORT_LIMIT = 5000

export type ActivityFilter = { range: ActivityRange; custom: [Dayjs, Dayjs] | null; area?: string; actor?: string; q: string }

/** Nguồn nhật ký cho trang Nhật ký: đọc từ máy chủ theo trang (`page` tính từ 0). */
export function useActivityFeed(filter: ActivityFilter, page: number) {
  const { from, to } = rangeBounds(filter.range, filter.custom)
  const params = {
    area: filter.area as ActivityAreaCode | undefined,
    actorId: filter.actor ? Number(filter.actor) : undefined,
    q: filter.q.trim() || undefined,
    from: from?.toISOString(),
    to: to?.toISOString(),
  }
  const query = useQuery({
    queryKey: ['live', 'activity', 'feed', params, page],
    queryFn: () => activityApi.list({ ...params, page, size: ACTIVITY_PAGE_SIZE }),
    // Chỉ tự cập nhật ở trang đầu; trang sau đứng yên để dòng không bị xô khi có thao tác mới.
    refetchInterval: page === 0 ? 30_000 : false,
    // Đổi bộ lọc thì giữ danh sách cũ đến khi có kết quả mới, không chớp trắng.
    placeholderData: keepPreviousData,
  })
  const actors = useQuery({ queryKey: ['live', 'activity', 'actors'], queryFn: activityApi.actors, staleTime: 60_000 })
  const items = query.data?.content.map(fromLive) ?? []
  return {
    items,
    total: query.data?.totalElements ?? 0,
    loading: query.isPending,
    error: query.error ?? actors.error,
    refetch: () => void Promise.all([query.refetch(), actors.refetch()]),
    refreshing: query.isFetching,
    stale: query.isPlaceholderData,
    updatedAt: query.dataUpdatedAt,
    areaOptions: Object.entries(activityAreas).map(([value, label]) => ({ value, label })),
    actorOptions: (actors.data ?? []).map((actor) => ({ value: String(actor.id), label: actor.name })),
    /** Xuất toàn bộ kết quả đang lọc, tối đa 5.000 dòng; gọi lần lượt từng trang 100 dòng. */
    exportAll: async () => {
      const all: ActivityItem[] = []
      for (let page = 0; all.length < EXPORT_LIMIT; page += 1) {
        const result = await activityApi.list({ ...params, page, size: 100 })
        all.push(...result.content.map(fromLive))
        if ((page + 1) * result.size >= result.totalElements || !result.content.length) return { items: all, truncated: false }
      }
      return { items: all, truncated: true }
    },
  }
}
