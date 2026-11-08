import { useSyncExternalStore } from 'react'
import { carts } from './cartStore'
import { useShopDemo } from './shopService'

export { readProfile, saveProfile, type CartLine, type ShopProfile } from './cartStore'

const useCartStore = () => carts[useShopDemo() ? 'demo' : 'live']
export const useCartActions = () => useCartStore().actions
export const useCart = () => {
  const store = useCartStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
