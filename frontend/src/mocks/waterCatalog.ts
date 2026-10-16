import type { Product } from '../features/inventory/types'

// Danh mục mẫu tham khảo iWater ngày 16/10/2026. Giá minh họa, không đồng bộ trực tuyến.
export const waterProducts: Product[] = [
  {
    "id": "P-004",
    "name": "Nước khoáng LaVie 19 Lít (Vòi)",
    "brand": "LaVie",
    "unit": "Bình",
    "stock": 36,
    "threshold": 18,
    "price": 65000,
    "expiry": "18/05/2027",
    "sku": "LAVIE-19L",
    "image": "/images/reference/iwater/lavie-19l-voi.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-006",
    "name": "Nước tinh khiết ViVa 18,5L (Vòi)",
    "brand": "ViVa",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 62000,
    "expiry": "—",
    "sku": "VIVA-185L",
    "image": "/images/reference/iwater/viva-18-5l-voi.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 18500
    }
  },
  {
    "id": "P-007",
    "name": "Nước kiềm ion Life 19 Lít (Vòi)",
    "brand": "ion Life",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 73000,
    "expiry": "—",
    "sku": "IONLIFE-19L",
    "image": "/images/reference/iwater/ion-life-19l-voi.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-008",
    "name": "Nước hoàn lưu khoáng Satori 19L (Vòi)",
    "brand": "Satori",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 60000,
    "expiry": "—",
    "sku": "SATORI-19L",
    "image": "/images/reference/iwater/satori-19l-voi.png",
    "catalog": {
      "category": "Hoàn lưu khoáng",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-009",
    "name": "Nước tinh khiết Vihawa 20 Lít (Vòi)",
    "brand": "Vihawa",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 65000,
    "expiry": "—",
    "sku": "VIHAWA-20L",
    "image": "/images/reference/iwater/vihawa-20l-voi.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 20000
    }
  },
  {
    "id": "P-010",
    "name": "Nước tinh khiết Bidrico 19 Lít (Úp)",
    "brand": "Bidrico",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 42000,
    "expiry": "—",
    "sku": "BIDRICO-19L",
    "image": "/images/reference/iwater/bidrico-19l-up.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-011",
    "name": "Nước tinh khiết Aquafina 355ml",
    "brand": "Aquafina",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 105000,
    "expiry": "—",
    "sku": "AQUAFINA-355",
    "image": "/images/reference/iwater/aquafina-355ml.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 355
    }
  },
  {
    "id": "P-012",
    "name": "Nước khoáng LaVie 500ml Vị dịu nhẹ mới",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 100000,
    "expiry": "—",
    "sku": "LAVIE-500",
    "image": "/images/reference/iwater/lavie-500ml.jpg",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-013",
    "name": "Nước Aquafina Soda 320ml",
    "brand": "Aquafina",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 175000,
    "expiry": "—",
    "sku": "IW-3543",
    "image": "/images/products/iwater/nuoc-aquafina-soda-320ml-3543.jpg",
    "catalog": {
      "category": "Nước có ga",
      "packaging": "Thùng lon",
      "capacity": "250–355ml",
      "volumeMl": 320
    }
  },
  {
    "id": "P-014",
    "name": "Nước tinh khiết Aquafina 1,5 Lít",
    "brand": "Aquafina",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 125000,
    "expiry": "—",
    "sku": "IW-15",
    "image": "/images/products/iwater/nuoc-tinh-khiet-aquafina-15-lit-15.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1500
    }
  },
  {
    "id": "P-015",
    "name": "Nước tinh khiết Aquafina 5 Lít",
    "brand": "Aquafina",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 125000,
    "expiry": "—",
    "sku": "IW-10",
    "image": "/images/products/iwater/nuoc-tinh-khiet-aquafina-5-lit-10.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "4,5–5L",
      "volumeMl": 5000
    }
  },
  {
    "id": "P-016",
    "name": "Nước tinh khiết Aquafina 500ml",
    "brand": "Aquafina",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 110000,
    "expiry": "—",
    "sku": "AQUAFINA-500",
    "image": "/images/products/iwater/nuoc-tinh-khiet-aquafina-500ml-16.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-017",
    "name": "Nước tinh khiết Bidrico 19 Lít (Vòi)",
    "brand": "Bidrico",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 42000,
    "expiry": "—",
    "sku": "IW-2158",
    "image": "/images/products/iwater/nuoc-tinh-khiet--bidrico-19-lit-voi-2158.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-018",
    "name": "Nước tinh khiết Bidrico 500ml",
    "brand": "Bidrico",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 85000,
    "expiry": "—",
    "sku": "IW-26",
    "image": "/images/products/iwater/nuoc-tinh-khiet--bidrico-500ml-26.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-019",
    "name": "Nước tinh khiết Bidrico 350ml",
    "brand": "Bidrico",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 78000,
    "expiry": "—",
    "sku": "IW-25",
    "image": "/images/products/iwater/nuoc-tinh-khiet-bidrico-350ml-25.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-020",
    "name": "Nước tinh khiết Dasani 1.5L",
    "brand": "Dasani",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 95000,
    "expiry": "—",
    "sku": "IW-3510",
    "image": "/images/products/iwater/nuoc-tinh-khiet-dasani-15l-3510.jpg",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1500
    }
  },
  {
    "id": "P-021",
    "name": "Nước tinh khiết Dasani 350ml",
    "brand": "Dasani",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 85000,
    "expiry": "—",
    "sku": "IW-3339",
    "image": "/images/products/iwater/nuoc-tinh-khiet-dasani-350ml-3339.jpg",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-022",
    "name": "Nước tinh khiết Dasani 510ml",
    "brand": "Dasani",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 95000,
    "expiry": "—",
    "sku": "IW-2185",
    "image": "/images/products/iwater/nuoc-tinh-khiet-dasani-510ml-2185.jpg",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 510
    }
  },
  {
    "id": "P-023",
    "name": "Nước kiềm ion Life 1.25 Lít",
    "brand": "ion Life",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 148000,
    "expiry": "—",
    "sku": "IW-13",
    "image": "/images/products/iwater/nuoc-kiem-ion-life-125-lit-13.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1250
    }
  },
  {
    "id": "P-024",
    "name": "Nước kiềm ion Life 19 Lít (Úp)",
    "brand": "ion Life",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 73000,
    "expiry": "—",
    "sku": "IW-2157",
    "image": "/images/products/iwater/nuoc-kiem-ion-life-19-lit-up-2157.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-025",
    "name": "Nước kiềm ion Life 330ml",
    "brand": "ion Life",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 133000,
    "expiry": "—",
    "sku": "IW-14",
    "image": "/images/products/iwater/nuoc-kiem-ion-life-330ml-14.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 330
    }
  },
  {
    "id": "P-026",
    "name": "Nước kiềm ion Life 4,5 Lít",
    "brand": "ion Life",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 155000,
    "expiry": "—",
    "sku": "IW-2293",
    "image": "/images/products/iwater/nuoc-kiem-ion-life-45-lit-2293.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "4,5–5L",
      "volumeMl": 4500
    }
  },
  {
    "id": "P-027",
    "name": "Nước kiềm ion Life 450ml",
    "brand": "ion Life",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 148000,
    "expiry": "—",
    "sku": "IW-12",
    "image": "/images/products/iwater/nuoc-kiem-ion-life-450ml-12.png",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 450
    }
  },
  {
    "id": "P-028",
    "name": "Nước khoáng có ga LaVie Glass 450ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 590000,
    "expiry": "—",
    "sku": "IW-3381",
    "image": "/images/products/iwater/nuoc-khoang-co-ga-lavie-glass-450ml-3381.jpg",
    "catalog": {
      "category": "Nước có ga",
      "packaging": "Thùng chai thủy tinh",
      "capacity": "390–520ml",
      "volumeMl": 450
    }
  },
  {
    "id": "P-029",
    "name": "Nước khoáng không ga LaVie Glass 450ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 550000,
    "expiry": "—",
    "sku": "IW-3382",
    "image": "/images/products/iwater/nuoc-khoang-khong-ga-lavie-glass-450ml-3382.jpg",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai thủy tinh",
      "capacity": "390–520ml",
      "volumeMl": 450
    }
  },
  {
    "id": "P-030",
    "name": "Nước khoáng LaVie 1,5 Lít",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 110000,
    "expiry": "—",
    "sku": "IW-5",
    "image": "/images/products/iwater/nuoc-khoang-lavie-15-lit-5.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1500
    }
  },
  {
    "id": "P-031",
    "name": "Nước khoáng LaVie 19 Lít (Úp)",
    "brand": "LaVie",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 70000,
    "expiry": "—",
    "sku": "IW-1",
    "image": "/images/products/iwater/nuoc-khoang-lavie-19-lit-up-1.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-032",
    "name": "Nước khoáng LaVie 350ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 90000,
    "expiry": "—",
    "sku": "IW-2",
    "image": "/images/products/iwater/nuoc-khoang-lavie-350ml-2.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-033",
    "name": "Nước khoáng Lavie 5 Lít",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 120000,
    "expiry": "—",
    "sku": "IW-4",
    "image": "/images/products/iwater/nuoc-khoang-lavie-5-lit-4.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "4,5–5L",
      "volumeMl": 5000
    }
  },
  {
    "id": "P-034",
    "name": "Nước khoáng LaVie 500ml Nguyên bản",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 100000,
    "expiry": "—",
    "sku": "IW-3",
    "image": "/images/products/iwater/nuoc-khoang-lavie-500ml-nguyen-ban-3.jpg",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-035",
    "name": "Nước khoáng LaVie Premium 400ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 160000,
    "expiry": "—",
    "sku": "IW-2169",
    "image": "/images/products/iwater/nuoc-khoang-lavie-premium-400ml-2169.jpg",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 400
    }
  },
  {
    "id": "P-036",
    "name": "Nước kiềm LaVie 500ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 115000,
    "expiry": "—",
    "sku": "IW-3538",
    "image": "/images/products/iwater/nuoc-kiem-lavie-500ml-3538.jpg",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-037",
    "name": "Nước kiềm LaVie 750ml",
    "brand": "LaVie",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 120000,
    "expiry": "—",
    "sku": "IW-3539",
    "image": "/images/products/iwater/nuoc-kiem-lavie-750ml-3539.jpg",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Thùng chai",
      "capacity": "750–900ml",
      "volumeMl": 750
    }
  },
  {
    "id": "P-038",
    "name": "Nước LaVie kiềm 18.5 Lít (Vòi)",
    "brand": "LaVie",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 72000,
    "expiry": "—",
    "sku": "IW-3536",
    "image": "/images/products/iwater/nuoc-lavie-kiem-185-lit-voi-3536.jpg",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 18500
    }
  },
  {
    "id": "P-039",
    "name": "Nước LaVie kiềm 19 Lít (úp)",
    "brand": "LaVie",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 72000,
    "expiry": "—",
    "sku": "IW-3537",
    "image": "/images/products/iwater/nuoc-lavie-kiem-19-lit-up-3537.jpg",
    "catalog": {
      "category": "Ion kiềm",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-040",
    "name": "Nước tinh khiết Lemont 250ml",
    "brand": "Lemont",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 65000,
    "expiry": "—",
    "sku": "IW-3541",
    "image": "/images/products/iwater/nuoc-tinh-khiet-lemont-250ml-3541.jpg",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 250
    }
  },
  {
    "id": "P-041",
    "name": "Nước Revive bù khoáng 500ml",
    "brand": "Revive",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 190000,
    "expiry": "—",
    "sku": "IW-3502",
    "image": "/images/products/iwater/nuoc-revive-bu-khoang-500ml-3502.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-042",
    "name": "Nước Revive muối khoáng 390ml",
    "brand": "Revive",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 180000,
    "expiry": "—",
    "sku": "IW-3434",
    "image": "/images/products/iwater/nuoc-revive-muoi-khoang-390ml-3434.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 390
    }
  },
  {
    "id": "P-043",
    "name": "Thức uống bổ sung ion Pocari Sweat Chai nhựa 350ml",
    "brand": "Pocari Sweat",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 286000,
    "expiry": "—",
    "sku": "IW-3454",
    "image": "/images/products/iwater/thuc-uong-bo-sung-ion-pocari-sweat-chai-nhua-350ml-3454.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-044",
    "name": "Thức uống bổ sung ion Pocari Sweat Chai nhựa 500ml",
    "brand": "Pocari Sweat",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 345000,
    "expiry": "—",
    "sku": "IW-3428",
    "image": "/images/products/iwater/thuc-uong-bo-sung-ion-pocari-sweat-chai-nhua-500ml-3428.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-045",
    "name": "Thức uống bổ sung ion Pocari Sweat Chai nhựa 900ml",
    "brand": "Pocari Sweat",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 345000,
    "expiry": "—",
    "sku": "IW-3457",
    "image": "/images/products/iwater/thuc-uong-bo-sung-ion-pocari-sweat-chai-nhua-900ml-3457.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng chai",
      "capacity": "750–900ml",
      "volumeMl": 900
    }
  },
  {
    "id": "P-046",
    "name": "Thức uống bổ sung ion Pocari Sweat Lon 330ml",
    "brand": "Pocari Sweat",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 298000,
    "expiry": "—",
    "sku": "IW-3456",
    "image": "/images/products/iwater/thuc-uong-bo-sung-ion-pocari-sweat-lon-330ml-3456.jpg",
    "catalog": {
      "category": "Bù khoáng & điện giải",
      "packaging": "Thùng lon",
      "capacity": "250–355ml",
      "volumeMl": 330
    }
  },
  {
    "id": "P-047",
    "name": "Nước Rosée chai 330ml (24 chai)",
    "brand": "Rosée",
    "unit": "Lốc",
    "stock": 0,
    "threshold": 10,
    "price": 68000,
    "expiry": "—",
    "sku": "IW-3313",
    "image": "/images/products/iwater/nuoc-rosee-chai-330ml-24-chai-3313.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Lốc chai",
      "capacity": "250–355ml",
      "volumeMl": 330
    }
  },
  {
    "id": "P-048",
    "name": "Nước Rosée chai 520ml (24 chai)",
    "brand": "Rosée",
    "unit": "Lốc",
    "stock": 0,
    "threshold": 10,
    "price": 78000,
    "expiry": "—",
    "sku": "IW-3341",
    "image": "/images/products/iwater/nuoc-rosee-chai-520ml-24-chai-3341.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Lốc chai",
      "capacity": "390–520ml",
      "volumeMl": 520
    }
  },
  {
    "id": "P-049",
    "name": "Nước tinh khiết Rosée 19L (Úp)",
    "brand": "Rosée",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 38000,
    "expiry": "—",
    "sku": "IW-3337",
    "image": "/images/products/iwater/nuoc-tinh-khiet-rosee-19l-up-3337.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-050",
    "name": "Nước tinh khiết Rosée 19L (Vòi)",
    "brand": "Rosée",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 38000,
    "expiry": "—",
    "sku": "IW-3336",
    "image": "/images/products/iwater/nuoc-tinh-khiet-rosee-19l-voi-3336.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-051",
    "name": "Nước hoàn lưu khoáng Satori 1,5 Lít",
    "brand": "Satori",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 100000,
    "expiry": "—",
    "sku": "IW-2253",
    "image": "/images/products/iwater/nuoc-hoan-luu-khoang-satori-15-lit-2253.png",
    "catalog": {
      "category": "Hoàn lưu khoáng",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1500
    }
  },
  {
    "id": "P-052",
    "name": "Nước hoàn lưu khoáng Satori 20L (Úp)",
    "brand": "Satori",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 60000,
    "expiry": "—",
    "sku": "IW-2252",
    "image": "/images/products/iwater/nuoc-hoan-luu-khoang-satori-20l-up-2252.png",
    "catalog": {
      "category": "Hoàn lưu khoáng",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 20000
    }
  },
  {
    "id": "P-053",
    "name": "Nước hoàn lưu khoáng Satori 350ml",
    "brand": "Satori",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 90000,
    "expiry": "—",
    "sku": "IW-2250",
    "image": "/images/products/iwater/nuoc-hoan-luu-khoang-satori-350ml-2250.png",
    "catalog": {
      "category": "Hoàn lưu khoáng",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-054",
    "name": "Nước hoàn lưu khoáng Satori 500ml",
    "brand": "Satori",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 100000,
    "expiry": "—",
    "sku": "IW-2251",
    "image": "/images/products/iwater/nuoc-hoan-luu-khoang-satori-500ml-2251.png",
    "catalog": {
      "category": "Hoàn lưu khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-055",
    "name": "Nước tinh khiết TH true Water 350ml",
    "brand": "TH true Water",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 95000,
    "expiry": "—",
    "sku": "IW-3318",
    "image": "/images/products/iwater/nuoc-tinh-khiet-th-true-water-350ml-3318.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-056",
    "name": "Nước tinh khiết TH true Water 500ml",
    "brand": "TH true Water",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 105000,
    "expiry": "—",
    "sku": "IW-3319",
    "image": "/images/products/iwater/nuoc-tinh-khiet-th-true-water-500ml-3319.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-057",
    "name": "Nước tinh khiết TH true Water bình 19L (Úp)",
    "brand": "TH true Water",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 83000,
    "expiry": "—",
    "sku": "IW-3317",
    "image": "/images/products/iwater/nuoc-tinh-khiet-th-true-water-binh-19l-up-3317.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 19000
    }
  },
  {
    "id": "P-058",
    "name": "Nước khoáng Chanh Vĩnh Hảo 500ml",
    "brand": "Vĩnh Hảo",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 185000,
    "expiry": "—",
    "sku": "IW-27",
    "image": "/images/products/iwater/nuoc-khoang-chanh-vinh-hao-500ml-27.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-059",
    "name": "Nước khoáng Vĩnh Hảo 1,5 Lít",
    "brand": "Vĩnh Hảo",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 115000,
    "expiry": "—",
    "sku": "IW-3509",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-15-lit-3509.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "1–1,5L",
      "volumeMl": 1500
    }
  },
  {
    "id": "P-060",
    "name": "Nước khoáng Vĩnh Hảo 20 Lít (Úp)",
    "brand": "Vĩnh Hảo",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 82000,
    "expiry": "—",
    "sku": "IW-2155",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-20-lit-up-2155.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 20000
    }
  },
  {
    "id": "P-061",
    "name": "Nước khoáng Vĩnh Hảo 20 Lít (Vòi)",
    "brand": "Vĩnh Hảo",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 82000,
    "expiry": "—",
    "sku": "IW-8",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-20-lit-voi-8.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Bình có vòi",
      "capacity": "18,5–20L",
      "volumeMl": 20000
    }
  },
  {
    "id": "P-062",
    "name": "Nước khoáng Vĩnh Hảo 350ml",
    "brand": "Vĩnh Hảo",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 95000,
    "expiry": "—",
    "sku": "IW-18",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-350ml-18.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "250–355ml",
      "volumeMl": 350
    }
  },
  {
    "id": "P-063",
    "name": "Nước khoáng Vĩnh Hảo 500ml",
    "brand": "Vĩnh Hảo",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 105000,
    "expiry": "—",
    "sku": "IW-19",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-500ml-19.png",
    "catalog": {
      "category": "Nước khoáng",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-064",
    "name": "Nước khoáng Vĩnh Hảo có gas 500ml",
    "brand": "Vĩnh Hảo",
    "unit": "Thùng",
    "stock": 0,
    "threshold": 10,
    "price": 185000,
    "expiry": "—",
    "sku": "IW-28",
    "image": "/images/products/iwater/nuoc-khoang-vinh-hao-co-gas-500ml-28.png",
    "catalog": {
      "category": "Nước có ga",
      "packaging": "Thùng chai",
      "capacity": "390–520ml",
      "volumeMl": 500
    }
  },
  {
    "id": "P-065",
    "name": "Nước tinh khiết Vihawa 20 Lít (Úp)",
    "brand": "Vihawa",
    "unit": "Bình",
    "stock": 0,
    "threshold": 10,
    "price": 65000,
    "expiry": "—",
    "sku": "IW-2156",
    "image": "/images/products/iwater/nuoc-tinh-khiet-vihawa-20-lit-up-2156.png",
    "catalog": {
      "category": "Tinh khiết",
      "packaging": "Bình úp máy",
      "capacity": "18,5–20L",
      "volumeMl": 20000
    }
  }
]
