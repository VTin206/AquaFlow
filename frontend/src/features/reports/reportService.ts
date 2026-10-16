import { useQuery } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockRequest } from '../../mocks/mockRequest'

// Đang dùng dữ liệu mẫu. Khi backend có API báo cáo, thay bằng api.get('/reports/revenue?...').

export type DailyRevenue = { date: string; revenue: number }

export const reportService = {
  dailyRevenue: () => mockRequest(() => db.dailyRevenue),
}

export const useDailyRevenue = () => useQuery({ queryKey: ['reports', 'daily-revenue'], queryFn: reportService.dailyRevenue })
