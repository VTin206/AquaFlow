import { useSyncExternalStore } from 'react'

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

let cart: CartLine[] = read<CartLine[]>(CART_KEY, []).filter((line) => line && typeof line.productId === 'string' && Number.isSafeInteger(line.quantity) && line.quantity > 0)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function setCart(next: CartLine[]) {
  cart = next.filter((line) => line.quantity > 0)
  write(CART_KEY, cart)
  emit()
}

export const cartActions = {
  add: (productId: string, quantity = 1) => {
    const existing = cart.find((line) => line.productId === productId)
    setCart(existing ? cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line)) : [...cart, { productId, quantity }])
  },
  set: (productId: string, quantity: number) => setCart(cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.max(0, Math.min(99, Math.floor(quantity))) } : line))),
  remove: (productId: string) => setCart(cart.filter((line) => line.productId !== productId)),
  clear: () => setCart([]),
}

export const useCart = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => cart,
  )

export const readProfile = () => read<ShopProfile | null>(PROFILE_KEY, null)
export const saveProfile = (profile: ShopProfile | null) => write(PROFILE_KEY, profile)
