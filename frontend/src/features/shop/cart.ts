import { useSyncExternalStore } from 'react'
import { useShopDemo } from './shopService'

// Giỏ hàng lưu trên trình duyệt của khách; mất cũng không sao vì chưa phải đơn.
const CART_KEY = 'aquaflow.shop.cart'
const PROFILE_KEY = 'aquaflow.shop.profile'

export type CartLine = { productId: string; quantity: number }
/** Thông tin giao hàng khách tự chọn lưu lại cho lần đặt sau (không cần tài khoản). */
export type ShopProfile = { customer: string; phone: string; address: string; floor?: number }

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Trình duyệt chặn bộ nhớ: giỏ hàng chỉ giữ trong phiên.
  }
}

function createCart(key: string) {
  const stored = read<unknown>(key, [])
  let cart: CartLine[] = Array.isArray(stored) ? stored.filter((line) => line && typeof line.productId === 'string' && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99) : []
  const listeners = new Set<() => void>()
  const setCart = (next: CartLine[]) => {
    cart = next.filter((line) => line.quantity > 0)
    write(key, cart)
    listeners.forEach((listener) => listener())
  }
  const actions = {
    add: (productId: string, quantity = 1) => {
      const existing = cart.find((line) => line.productId === productId)
      setCart(existing ? cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line)) : [...cart, { productId, quantity }])
    },
    set: (productId: string, quantity: number) => setCart(cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.max(0, Math.min(99, Math.floor(quantity))) } : line))),
    remove: (productId: string) => setCart(cart.filter((line) => line.productId !== productId)),
    clear: () => setCart([]),
  }
  return {
    actions,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => cart,
  }
}

// Các mã sản phẩm demo và thật không bao giờ dùng chung một giỏ.
const carts = { demo: createCart(CART_KEY), live: createCart(`${CART_KEY}.live`) }
const useCartStore = () => carts[useShopDemo() ? 'demo' : 'live']
export const useCartActions = () => useCartStore().actions
export const useCart = () => {
  const store = useCartStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

export const readProfile = () => read<ShopProfile | null>(PROFILE_KEY, null)
export const saveProfile = (profile: ShopProfile | null) => write(PROFILE_KEY, profile)
