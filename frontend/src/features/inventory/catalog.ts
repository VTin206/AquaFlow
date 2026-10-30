import type { Product } from './types'

type CatalogDetails = NonNullable<Product['catalog']>
export const catalogCategories = ['Tinh khiết', 'Nước khoáng', 'Ion kiềm', 'Hoàn lưu khoáng', 'Nước có ga', 'Bù khoáng & điện giải', 'Vỏ bình & phụ kiện', 'Chưa phân loại']
export const capacityGroups = ['250–355ml', '390–520ml', '750–900ml', '1–1,5L', '4,5–5L', '18,5–20L', 'Chưa có dung tích']

type BrandGroup = { name: string; aliases: string[]; logo?: string }
export const brandGroups: BrandGroup[] = [
  { name: 'LaVie', aliases: ['lavie', 'viva'], logo: '/images/brands/lavie.png' },
  { name: 'Vĩnh Hảo', aliases: ['vĩnh hảo', 'vihawa'], logo: '/images/brands/vinh-hao.png' },
  { name: 'Aquafina', aliases: ['aquafina'], logo: '/images/brands/aquafina.png' },
  { name: 'ion Life', aliases: ['ion life'], logo: '/images/brands/ion-life.png' },
  { name: 'Satori', aliases: ['satori'], logo: '/images/brands/satori.png' },
  { name: 'Bidrico', aliases: ['bidrico'], logo: '/images/brands/bidrico.png' },
  { name: 'Rosée', aliases: ['rosée', 'rosee'], logo: '/images/brands/rosee.png' },
  { name: 'TH true Water', aliases: ['th true water'], logo: '/images/brands/th-true-water.png' },
  { name: 'Dasani', aliases: ['dasani'] },
  { name: 'Pocari Sweat', aliases: ['pocari sweat'] },
  { name: 'Revive (Pepsi)', aliases: ['revive', 'pepsi'], logo: '/images/brands/pepsi.png' },
  { name: 'Lemont', aliases: ['lemont'] },
  // Còn trong menu iWater, nhưng chưa có sản phẩm xác minh được tại các trang này.
  { name: 'Sapuwa', aliases: ['sapuwa'] },
  { name: 'Wami', aliases: ['wami'] },
  { name: '333', aliases: ['333'] },
  { name: 'Đảnh Thạch', aliases: ['đảnh thạch'] },
  { name: 'Thạch Bích', aliases: ['thạch bích'] },
]

export const getBrandGroup = (brand: string) => brandGroups.find((group) => group.aliases.includes(brand.trim().toLowerCase()))
export const getCatalogDetails = (product: Pick<Product, 'catalog' | 'sku' | 'unit'>): CatalogDetails => product.catalog ?? (product.sku === 'VO-20L'
  ? { category: 'Vỏ bình & phụ kiện', packaging: 'Vỏ bình', capacity: '18,5–20L', volumeMl: 20000 }
  : { category: 'Chưa phân loại', packaging: product.unit, capacity: 'Chưa có dung tích', volumeMl: 0 })

const capacityOf = (ml: number) =>
  ml <= 0 ? 'Chưa có dung tích' : ml <= 355 ? '250–355ml' : ml <= 520 ? '390–520ml' : ml <= 900 ? '750–900ml' : ml <= 1500 ? '1–1,5L' : ml <= 6000 ? '4,5–5L' : '18,5–20L'

/**
 * Đoán loại nước, quy cách, dung tích từ tên sản phẩm khi BE chưa trả `catalog` (ProductResponse chưa có),
 * để trang khách vẫn lọc được theo nhóm. Có dữ liệu từ BE thì dùng dữ liệu đó.
 */
export function inferCatalog(name: string, unit: string): CatalogDetails {
  const text = name.toLowerCase()
  if (unit.toLowerCase() === 'vỏ' || /^vỏ /.test(text)) return { category: 'Vỏ bình & phụ kiện', packaging: 'Vỏ bình', capacity: '18,5–20L', volumeMl: 20000 }
  const size = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|lít|l)(?![a-z])/)
  const volumeMl = size ? Math.round(Number(size[1].replace(',', '.')) * (size[2] === 'ml' ? 1 : 1000)) : 0
  const category = /có ga|có gas|soda/.test(text) ? 'Nước có ga'
    : /pocari|revive|bù khoáng|muối khoáng|bổ sung ion/.test(text) ? 'Bù khoáng & điện giải'
    : /hoàn lưu/.test(text) ? 'Hoàn lưu khoáng'
    : /kiềm/.test(text) ? 'Ion kiềm'
    : /khoáng/.test(text) ? 'Nước khoáng'
    : /tinh khiết/.test(text) ? 'Tinh khiết'
    : 'Chưa phân loại'
  const packaging = /\(vòi\)/.test(text) ? 'Bình có vòi'
    : /\(úp\)/.test(text) || unit.toLowerCase() === 'bình' ? 'Bình úp máy'
    : /(^|\s)lon(\s|$)/.test(text) ? 'Thùng lon'
    : /glass|thủy tinh/.test(text) ? 'Thùng chai thủy tinh'
    : unit.toLowerCase() === 'lốc' ? 'Lốc chai'
    : 'Thùng chai'
  return { category, packaging, capacity: capacityOf(volumeMl), volumeMl }
}

export { normalizeSearch } from '../../shared/utils/search'
