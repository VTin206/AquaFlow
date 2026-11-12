import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Dayjs } from 'dayjs'
import { activityApi, activityAreas, type ActivityAreaCode } from './activityApi'
import { fromLive, rangeBounds, type ActivityItem, type ActivityRange } from './activityFeed'

const PAGE = 50
const EXPORT_LIMIT = 5000

export type ActivityFilter = { range: ActivityRange; custom: [Dayjs, Dayjs] | null; area?: string; actor?: string; q: string }

/** Nguồn nhật ký cho trang Nhật ký: đọc từ máy chủ theo từng đợt 50 dòng. */
export function useActivityFeed(filter: ActivityFilter) {
  const { from, to } = rangeBounds(filter.range, filter.custom)
  const params = {
    area: filter.area as ActivityAreaCode | undefined,
    actorId: filter.actor ? Number(filter.actor) : undefined,
    q: filter.q.trim() || undefined,
    from: from?.toISOString(),
    to: to?.toISOString(),
  }
  const query = useInfiniteQuery({
    queryKey: ['live', 'activity', 'feed', params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => activityApi.list({ ...params, page: pageParam, size: PAGE }),
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
    refetchInterval: 30_000,
    // Đổi bộ lọc thì giữ danh sách cũ đến khi có kết quả mới, không chớp trắng.
    placeholderData: keepPreviousData,
  })
  const actors = useQuery({ queryKey: ['live', 'activity', 'actors'], queryFn: activityApi.actors, staleTime: 60_000 })
  const items = query.data?.pages.flatMap((page) => page.content.map(fromLive)) ?? []
  return {
    items,
    total: query.data?.pages[0]?.totalElements ?? 0,
    loading: query.isPending,
    error: query.error ?? actors.error,
    refetch: () => void Promise.all([query.refetch(), actors.refetch()]),
    refreshing: query.isFetching && !query.isFetchingNextPage,
    stale: query.isPlaceholderData,
    updatedAt: query.dataUpdatedAt,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
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
