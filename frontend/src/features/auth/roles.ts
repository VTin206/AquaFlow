// Mã vai trò khớp với bảng roles ở backend (SecurityConfig).
const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  SALES_STAFF: 'Nhân viên bán hàng',
  DELIVERY_STAFF: 'Nhân viên giao hàng',
  CUSTOMER: 'Khách hàng',
}

export const roleLabel = (role: string) => roleLabels[role] ?? role

/** Vai trò được vào không gian quản lý cửa hàng; khách hàng dùng kênh riêng. */
export const STAFF_ROLES = ['ADMIN', 'SALES_STAFF', 'DELIVERY_STAFF']
