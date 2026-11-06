import type { SupplierRecord } from '@/features/suppliers/types'

/**
 * Nhà cung cấp mẫu là các hãng nước thật mà đại lý thường nhập, khớp thương hiệu trong danh mục sản phẩm mẫu.
 * Tên pháp nhân và địa chỉ lấy từ nguồn công khai (có thể đã đổi); số điện thoại là số giả,
 * người liên hệ chỉ ghi phòng ban, không ghi tên hay email thật.
 */
export const initialSuppliers: SupplierRecord[] = [
  {
    id: 'NCC-001',
    name: 'Công ty TNHH La Vie (nước LaVie)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000001',
    address: '360A Bến Vân Đồn, TP. Hồ Chí Minh',
  },
  {
    id: 'NCC-002',
    name: 'Công ty CP Nước khoáng Vĩnh Hảo (Vĩnh Hảo, Vihawa)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000002',
    address: '346 Hải Thượng Lãn Ông, Phan Thiết, tỉnh Lâm Đồng',
  },
  {
    id: 'NCC-003',
    name: 'Công ty TNHH Nước giải khát Suntory PepsiCo Việt Nam (Aquafina)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000003',
    address: 'Tầng 5, 88 Đồng Khởi, TP. Hồ Chí Minh',
  },
  {
    id: 'NCC-004',
    name: 'Công ty TNHH Nước giải khát Coca-Cola Việt Nam (Dasani)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000004',
    address: '485 Xa lộ Hà Nội, TP. Hồ Chí Minh',
  },
  {
    id: 'NCC-005',
    name: 'Công ty CP Đầu tư và Thương mại Satori (nước Satori)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000005',
    address: 'KCN Long Hậu, tỉnh Tây Ninh',
  },
  {
    id: 'NCC-006',
    name: 'Công ty TNHH SX&TM Tân Quang Minh (Bidrico)',
    contactName: 'Phòng kinh doanh',
    phone: '0900000006',
    address: 'KCN Vĩnh Lộc, TP. Hồ Chí Minh',
  },
]
