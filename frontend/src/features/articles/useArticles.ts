import { useQuery } from '@tanstack/react-query'
import { articleApi, articleKeys, type ArticleKind } from './articleApi'

/** Bài viết ít đổi nên giữ 5 phút; chủ cửa hàng lưu bài thì khóa bị làm mới ngay. */
const STALE_MS = 5 * 60_000

export const usePublishedArticles = (kind: ArticleKind) =>
  useQuery({ queryKey: articleKeys.published(kind), queryFn: () => articleApi.published(kind), staleTime: STALE_MS })

export const useArticle = (slug: string) =>
  useQuery({ queryKey: articleKeys.bySlug(slug), queryFn: () => articleApi.bySlug(slug), staleTime: STALE_MS, enabled: slug !== '' })
