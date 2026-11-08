import { DEPOSIT_PER_BOTTLE, guessCustomerType, normalizePhone, type BottleEntry, type CustomerRecord } from '@/features/customers/types'
import type { Order } from '@/features/orders/types'
import type { Product } from '@/features/inventory/types'
import { waterProducts } from './waterCatalog'
import { additionalCustomers, additionalOrders, type SeedCustomer } from './demoScenarios'

const originalOrders: Order[] = [
  {
    id: 'AF-1048',
    customer: 'Nguyễn Văn An',
    phone: '0903 456 128',
    address: 'Phường Thảo Điền, TP. Thủ Đức',
    items: '2 bình 20L, 1 thùng 500ml',
    total: 185000,
    time: '09:42',
    status: 'Đang giao',
    method: 'Giao tận nơi',
  },
  {
    id: 'AF-1047',
    customer: 'Cửa hàng Minh Tâm',
    phone: '0918 220 467',
    address: 'Đường Nguyễn Văn Linh, Quận 7',
    items: '10 bình 20L',
    total: 1200000,
    time: '09:28',
    status: 'Đã hoàn tất',
    method: 'Giao tận nơi',
  },
  {
    id: 'AF-1046',
    customer: 'Trần Thị Hương',
    phone: '0938 113 602',
    address: 'Phường 6, Quận 3',
    items: '1 bình 20L + vỏ bình',
    total: 95000,
    time: '09:16',
    status: 'Chờ xác nhận',
    method: 'Giao tận nơi',
  },
  {
    id: 'AF-1045',
    customer: 'Văn phòng Green Hub',
    phone: '028 3822 8855',
    address: 'Đường Điện Biên Phủ, Bình Thạnh',
    items: '5 thùng chai 500ml',
    total: 450000,
    time: '08:54',
    status: 'Đang chuẩn bị',
    method: 'Giao tận nơi',
  },
  {
    id: 'AF-1044',
    customer: 'Lê Hoàng Phúc',
    phone: '0908 772 351',
    address: 'Khách nhận tại cửa hàng',
    items: '3 bình 20L',
    total: 210000,
    time: '08:31',
    status: 'Đã hoàn tất',
    method: 'Tại quầy',
  },
].map((fixture) => {
  const quantity =
    fixture.id === 'AF-1047' ? 10 : fixture.id === 'AF-1044' ? 3 : fixture.id === 'AF-1045' ? 5 : fixture.id === 'AF-1048' ? 2 : 1
  const bottled = fixture.id === 'AF-1045'
  const lines = [
    {
      productId: bottled ? 'P-016' : 'P-009',
      name: bottled ? 'Nước tinh khiết Aquafina 500ml' : 'Nước tinh khiết Vihawa 20 Lít (Vòi)',
      unit: bottled ? 'Thùng' : 'Bình',
      quantity,
      unitPrice: fixture.total / quantity,
    },
  ]
  return {
    ...fixture,
    status: fixture.status as Order['status'],
    method: fixture.method as Order['method'],
    channel: 'Điện thoại' as const,
    lines,
    items: lines.map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', '),
    deliveryFee: 0,
    stockReserved: ['Đang chuẩn bị', 'Đang giao'].includes(fixture.status),
    payments:
      fixture.status === 'Đã hoàn tất'
        ? [{ id: `PT-${fixture.id}-1`, amount: fixture.total, method: 'Tiền mặt' as const, recordedAt: '2026-10-16T02:00:00+07:00' }]
        : [],
    history: [{ at: '2026-10-16T01:00:00+07:00', message: 'Đơn minh họa với giá tại thời điểm giao dịch.' }],
  }
})

export const initialProducts: Product[] = [
  // Tồn khả dụng và hạn dùng minh họa, không phải số liệu từ iWater.
  // Các mã dùng trong đơn có hàng để thử tiếp nhận/xác nhận đơn.
  ...waterProducts.map((product, index) => ({
    ...product,
    stock: ['P-004', 'P-009', 'P-010', 'P-012', 'P-016'].includes(product.id)
      ? 48 + index * 2
      : index % 11 === 0
        ? 0
        : index % 5 === 0
          ? 4
          : 20 + ((index * 3) % 65),
    expiry: index % 9 === 0 ? '30/11/2026' : index % 7 === 0 ? '31/01/2027' : '30/09/2027',
  })),
  {
    id: 'P-002',
    name: 'Vỏ bình 20L',
    brand: 'Dùng luân chuyển',
    unit: 'Vỏ',
    stock: 28,
    threshold: 35,
    price: 50000,
    expiry: '—',
    sku: 'VO-20L',
  },
]

const seedCustomers: SeedCustomer[] = [
  ...additionalCustomers,
  { name: 'Nguyễn Văn An', phone: '0903 456 128', area: 'Thảo Điền, TP. Thủ Đức', orders: 28, bottlesHeld: 2 },
  { name: 'Cửa hàng Minh Tâm', phone: '0918 220 467', area: 'Quận 7', orders: 64, bottlesHeld: 0 },
  { name: 'Trần Thị Hương', phone: '0938 113 602', area: 'Quận 3', orders: 12, bottlesHeld: 1 },
  { name: 'Văn phòng Green Hub', phone: '028 3822 8855', area: 'Bình Thạnh', orders: 19, bottlesHeld: 5 },
  { name: 'Lê Hoàng Phúc', phone: '0908 772 351', area: 'Phú Nhuận', orders: 8, bottlesHeld: 0 },
]
const allOrders = [...additionalOrders, ...originalOrders]

export const customers: CustomerRecord[] = seedCustomers.map((seed, index) => {
  const addresses = [
    ...new Set(
      allOrders
        .filter((order) => normalizePhone(order.phone) === normalizePhone(seed.phone) && order.method === 'Giao tận nơi')
        .map((order) => order.address),
    ),
  ]
  const ordersInSystem = allOrders.filter((order) => normalizePhone(order.phone) === normalizePhone(seed.phone)).length
  return {
    id: `KH-${String(index + 1).padStart(3, '0')}`,
    name: seed.name,
    phone: seed.phone,
    type: guessCustomerType(seed.name),
    area: seed.area,
    addresses: addresses.length ? addresses : [seed.area],
    legacyOrders: Math.max(0, seed.orders - ordersInSystem),
  }
})

/** Số vỏ khách đang giữ khi bắt đầu dùng hệ thống, kèm tiền cọc tương ứng. */
export const bottleLedger: BottleEntry[] = seedCustomers.flatMap((seed, index) =>
  seed.bottlesHeld > 0
    ? [
        {
          id: `SV-${String(index + 1).padStart(4, '0')}`,
          customerId: customers[index].id,
          at: '2026-10-01T08:00:00+07:00',
          kind: 'Số dư đầu kỳ' as const,
          bottles: seed.bottlesHeld,
          deposit: seed.bottlesHeld * DEPOSIT_PER_BOTTLE,
          note: 'Chuyển số dư từ sổ tay.',
        },
      ]
    : [],
)

export const initialOrders: Order[] = allOrders.map((order) => ({
  ...order,
  customerId: customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(order.phone))?.id,
}))
