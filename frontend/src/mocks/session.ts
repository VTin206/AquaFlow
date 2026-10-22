import type { RoleCode } from '../features/auth/permissions'
import { db } from './db'
import { mockError } from './mockRequest'

// Backend thật lấy người thao tác và vai trò từ JWT; bản mô phỏng nhận từ giao diện qua setMockSession.

type MockSession = { name: string; role: RoleCode | 'CUSTOMER' }

let session: MockSession = { name: 'Hệ thống', role: 'ADMIN' }

export const setMockSession = (next: MockSession) => {
  session = next
}

export const mockActor = () => session.name

/** Giống kiểm tra quyền tại API: vai trò không đủ thì trả 403. */
export function requireRole(roles: MockSession['role'][], action: string) {
  if (!roles.includes(session.role)) throw mockError(403, `Bạn không có quyền ${action}.`)
}

/** Chạy `handler` dưới danh nghĩa khách đặt qua website rồi trả lại phiên nhân viên. */
export function asCustomer<T>(name: string, handler: () => T): T {
  const previous = session
  session = { name: `${name} (khách, website)`, role: 'CUSTOMER' }
  try {
    return handler()
  } finally {
    session = previous
  }
}

export type ActivityArea = 'Đơn hàng' | 'Thanh toán' | 'Kho hàng' | 'Khách hàng' | 'Giao hàng' | 'Nhà cung cấp' | 'Cài đặt'

/** Một dòng nhật ký chỉ được thêm, không sửa hoặc xóa. */
export type ActivityEntry = { id: string; at: string; by: string; area: ActivityArea; target: string; action: string }

export function logActivity(area: ActivityArea, target: string, action: string, at = new Date().toISOString()) {
  const entry: ActivityEntry = { id: `NK-${String(db.activity.length + 1).padStart(5, '0')}`, at, by: mockActor(), area, target, action }
  db.activity.push(entry)
  return entry
}
