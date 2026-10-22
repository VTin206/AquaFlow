import { bottleLedger, customers, initialOrders, initialProducts } from './data'
import { archivedOrders, seedActivity, withActors } from './history'
import { initialLots, initialReceipts } from './inventory'
import { initialSettings } from './settings'
import { initialSuppliers } from './suppliers'
import { initialTrips } from './trips'

const orders = withActors(initialOrders)
const archived = archivedOrders(initialProducts, customers)

// "Database" trong bộ nhớ cho chế độ dữ liệu mẫu. Mất dữ liệu khi tải lại trang.
export const db = {
  orders: structuredClone(orders),
  /** Đơn đã đóng của các ngày trước, chỉ dùng cho báo cáo theo kỳ. */
  archivedOrders: archived,
  products: structuredClone(initialProducts),
  customers: structuredClone(customers),
  bottleLedger: structuredClone(bottleLedger),
  suppliers: structuredClone(initialSuppliers),
  lots: structuredClone(initialLots),
  receipts: structuredClone(initialReceipts),
  trips: structuredClone(initialTrips),
  settings: structuredClone(initialSettings),
  /** Nhật ký thao tác chỉ thêm, không sửa/xóa. */
  activity: seedActivity([...archived, ...orders]),
}
