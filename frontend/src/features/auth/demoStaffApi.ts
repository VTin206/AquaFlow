import { mockError, mockRequest } from '@/mocks/mockRequest'
import type { StaffAccount, StaffCreate, StaffUpdate } from './staffApi'

// Dữ liệu mẫu đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung trang nhân viên.
let accounts: StaffAccount[] = [
  { id: 1, fullName: 'Trần Thu Hà', email: 'ha.ban@example.com', phone: '0901000001', role: 'SALES_STAFF', status: 'ACTIVE' },
  { id: 2, fullName: 'Lê Minh Quân', email: 'quan.ban@example.com', phone: null, role: 'SALES_STAFF', status: 'ACTIVE' },
  { id: 3, fullName: 'Phạm Văn Tài', email: 'tai.giao@example.com', phone: '0901000003', role: 'DELIVERY_STAFF', status: 'ACTIVE' },
  { id: 4, fullName: 'Võ Anh Khoa', email: 'khoa.giao@example.com', phone: '0901000004', role: 'DELIVERY_STAFF', status: 'INACTIVE' },
]

const checkPassword = (password: string) => {
  if (password.length < 12) throw mockError(400, 'Mật khẩu cần ít nhất 12 ký tự.')
}

export const demoStaffApi = {
  list: () => mockRequest(() => accounts),
  create: ({ password, ...input }: StaffCreate) =>
    mockRequest(() => {
      checkPassword(password)
      if (accounts.some((account) => account.email.toLowerCase() === input.email.toLowerCase()))
        throw mockError(400, 'Email này đã có tài khoản.')
      const created: StaffAccount = {
        id: Math.max(0, ...accounts.map((account) => account.id)) + 1,
        ...input,
        phone: input.phone || null,
        status: 'ACTIVE',
      }
      accounts = [...accounts, created]
      return created
    }),
  update: (id: number, input: StaffUpdate) =>
    mockRequest(() => {
      const current = accounts.find((account) => account.id === id)
      if (!current) throw mockError(404, 'Không tìm thấy nhân viên.')
      const updated: StaffAccount = { ...current, ...input, phone: input.phone || null }
      accounts = accounts.map((account) => (account.id === id ? updated : account))
      return updated
    }),
  password: (id: number, password: string) =>
    mockRequest(() => {
      checkPassword(password)
      if (!accounts.some((account) => account.id === id)) throw mockError(404, 'Không tìm thấy nhân viên.')
    }),
}
