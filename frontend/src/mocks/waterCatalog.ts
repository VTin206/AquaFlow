import type { Product } from '@/features/inventory/types'
import data from './waterCatalog.json'

// Danh mục mẫu tham khảo iWater ngày 16/10/2026. Giá minh họa, không đồng bộ trực tuyến. Dữ liệu nằm trong waterCatalog.json.
export const waterProducts = data as Product[]
