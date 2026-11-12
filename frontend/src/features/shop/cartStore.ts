// Giỏ hàng lưu trên trình duyệt của khách; mất cũng không sao vì chưa phải đơn.
// Module này không phụ thuộc React hay dịch vụ nào để AuthProvider gọi được khi kết thúc phiên.
const CART_KEY = 'aquaflow.shop.cart.live'
/** Giỏ của bản dùng thử đã bỏ; xóa để không còn sót trên máy. */
const LEGACY_DEMO_CART_KEY = 'aquaflow.shop.cart'
const PROFILE_KEY = 'aquaflow.shop.profile'

export type CartLine = { productId: string; quantity: number }
/** Thông tin giao hàng khách tự chọn lưu lại cho lần đặt sau (không cần tài khoản). */
export type ShopProfile = { customer: string; phone: string; address: string; area?: string; floor?: number }

const read = <T>(key: string, fallback: T): T => {
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
  let cart: CartLine[] = Array.isArray(stored)
    ? stored.filter(
        (line) =>
          line && typeof line.productId === 'string' && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99,
      )
    : []
  const listeners = new Set<() => void>()
  const setCart = (next: CartLine[]) => {
    cart = next.filter((line) => line.quantity > 0)
    write(key, cart)
    listeners.forEach((listener) => listener())
  }
  const actions = {
    add: (productId: string, quantity = 1) => {
      const existing = cart.find((line) => line.productId === productId)
      setCart(
        existing
          ? cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line))
          : [...cart, { productId, quantity }],
      )
    },
    set: (productId: string, quantity: number) =>
      setCart(
        cart.map((line) => (line.productId === productId ? { ...line, quantity: Math.max(0, Math.min(99, Math.floor(quantity))) } : line)),
      ),
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

write(LEGACY_DEMO_CART_KEY, null)
export const shopCart = createCart(CART_KEY)

export const readProfile = () => read<ShopProfile | null>(PROFILE_KEY, null)
export const saveProfile = (profile: ShopProfile | null) => write(PROFILE_KEY, profile)

/** Hết phiên: bỏ tên, số điện thoại, địa chỉ để người dùng sau trên cùng máy không thấy. Giữ giỏ để khách đăng nhập lại đặt tiếp. */
export const forgetSavedProfile = () => saveProfile(null)

/** Khách chủ động đăng xuất: không để lại gì của họ trên máy. */
export const clearShopData = () => {
  forgetSavedProfile()
  shopCart.actions.clear()
}
