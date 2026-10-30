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

export { normalizeSearch } from '../../shared/utils/search'
