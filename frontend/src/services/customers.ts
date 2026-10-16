import { db } from '../mocks/db'
import { mockRequest } from '../mocks/mockRequest'

// Đang dùng dữ liệu mẫu. Khi backend có API, thay bằng `api.get<Customer[]>('/customers')`.

export const customerService = {
  list: () => mockRequest(() => db.customers),
}
