import { useQuery } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockRequest } from '../../mocks/mockRequest'
import { requireRole } from '../../mocks/session'

export type { ActivityArea, ActivityEntry } from '../../mocks/session'

// Backend thật ghi nhật ký bất biến phía máy chủ; giao diện chỉ đọc, không có sửa/xóa.
export const activityService = {
  list: () =>
    mockRequest(() => {
      requireRole(['ADMIN'], 'xem nhật ký hoạt động')
      return [...db.activity].reverse()
    }),
}

export const useActivity = () => useQuery({ queryKey: ['activity'], queryFn: activityService.list, staleTime: 0 })
