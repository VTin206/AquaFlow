import { api } from '@/shared/api/client'
export type StaffAccount = {
  id: number
  fullName: string
  email: string
  phone: string | null
  role: 'SALES_STAFF' | 'DELIVERY_STAFF'
  status: 'ACTIVE' | 'INACTIVE'
}
export type StaffCreate = Pick<StaffAccount, 'fullName' | 'email' | 'role'> & { phone?: string; password: string }
export type StaffUpdate = Pick<StaffAccount, 'fullName' | 'status'> & { phone?: string }
const base = '/admin/staff'
export const staffApi = {
  list: () => api.get<StaffAccount[]>(base),
  create: (body: StaffCreate) => api.post<StaffAccount>(base, body),
  update: (id: number, body: StaffUpdate) => api.put<StaffAccount>(`${base}/${id}`, body),
  password: (id: number, password: string) => api.put<void>(`${base}/${id}/password`, { password }),
}
