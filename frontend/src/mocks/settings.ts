import type { StoreSettings } from '../features/settings/types'

// Thông tin cửa hàng hư cấu cho bản demo.
export const initialSettings: StoreSettings = {
  storeName: 'Đại lý nước AquaFlow',
  address: '12 Đường số 3, Phường An Phú, TP. Hồ Chí Minh',
  phone: '0283 456 7890',
  email: 'lienhe@aquaflow.example',
  taxCode: '0312345678',
  bankName: 'Vietcombank',
  bankAccount: '0071000123456',
  bankHolder: 'DAI LY NUOC AQUAFLOW',
  invoiceNote: 'Cảm ơn quý khách. Vui lòng giữ vỏ bình để đổi ở lần đặt sau.',
  expiryWarningDays: 120,
  defaultLowStock: 10,
}
