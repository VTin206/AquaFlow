import { useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Dayjs } from 'dayjs'
import { useIsDemo } from '@/shared/features'
import { useOrders } from '@/features/orders/useOrders'
import { matchesSearch } from '@/shared/utils/search'
import { activityApi, activityAreas, type ActivityAreaCode } from './activityApi'
import { fromDemo, fromLive, rangeBounds, type ActivityItem, type ActivityRange } from './activityFeed'
import { useActivity, type ActivityArea } from './activityService'

const PAGE = 50
const EXPORT_LIMIT = 5000
const demoAreas: ActivityArea[] = ['Đơn hàng', 'Thanh toán', 'Kho hàng', 'Khách hàng', 'Giao hàng', 'Nhà cung cấp', 'Cài đặt']

export type ActivityFilter = { range: ActivityRange; custom: [Dayjs, Dayjs] | null; area?: string; actor?: string; q: string }

/**
 * Nguồn nhật ký cho trang Nhật ký: tài khoản thật đọc từ máy chủ theo từng đợt 50 dòng,
 * bản dùng thử lọc trên dữ liệu mẫu. Cả hai trả về cùng dạng để giao diện chỉ có một.
 */
export function useActivityFeed(filter: ActivityFilter) {
  const demo = useIsDemo()
  const live = useLiveFeed(filter, !demo)
  const sample = useDemoFeed(filter, demo)
  return demo ? sample : live
}

function useLiveFeed(filter: ActivityFilter, enabled: boolean) {
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
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => activityApi.list({ ...params, page: pageParam, size: PAGE }),
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
    refetchInterval: 30_000,
    // Đổi bộ lọc thì giữ danh sách cũ đến khi có kết quả mới, không chớp trắng.
    placeholderData: keepPreviousData,
  })
  const actors = useQuery({ queryKey: ['live', 'activity', 'actors'], queryFn: activityApi.actors, enabled, staleTime: 60_000 })
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

function useDemoFeed(filter: ActivityFilter, enabled: boolean) {
  const query = useActivity(enabled)
  const { data: orders = [] } = useOrders(enabled)
  const [shown, setShown] = useState(PAGE)
  // Đổi bộ lọc thì quay về 50 dòng đầu như bản thật (so theo nội dung, không theo đối tượng mới mỗi lần vẽ).
  const filterKey = JSON.stringify([filter.range, filter.custom?.map((day) => day.valueOf()), filter.area, filter.actor, filter.q])
  const [seenKey, setSeenKey] = useState(filterKey)
  if (seenKey !== filterKey) {
    setSeenKey(filterKey)
    setShown(PAGE)
  }
  const orderIds = new Set(orders.map((order) => order.id))
  const { from, to } = rangeBounds(filter.range, filter.custom)
  const all = (query.data ?? [])
    .filter(
      (entry) =>
        (!filter.area || entry.area === filter.area) &&
        (!filter.actor || entry.by === filter.actor) &&
        (!from || new Date(entry.at) >= from.toDate()) &&
        (!to || new Date(entry.at) < to.toDate()) &&
        matchesSearch(filter.q, `${entry.target} ${entry.action} ${entry.by}`),
    )
    .map((entry) => fromDemo(entry, orderIds))
  const people = [...new Set((query.data ?? []).map((entry) => entry.by))].sort((a, b) => a.localeCompare(b, 'vi'))
  return {
    items: all.slice(0, shown),
    total: all.length,
    loading: query.isPending,
    error: query.error,
    refetch: () => void query.refetch(),
    refreshing: query.isFetching,
    stale: false,
    updatedAt: query.dataUpdatedAt,
    hasMore: shown < all.length,
    loadingMore: false,
    loadMore: () => setShown((value) => value + PAGE),
    // Dữ liệu mẫu chỉ có những khu vực đã có thao tác; không hiện nút lọc bấm vào là trống.
    areaOptions: demoAreas.filter((value) => (query.data ?? []).some((entry) => entry.area === value)).map((value) => ({ value, label: value })),
    actorOptions: people.map((value) => ({ value, label: value })),
    exportAll: async () => ({ items: all, truncated: false }),
  }
}
