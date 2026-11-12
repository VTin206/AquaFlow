import { useSyncExternalStore } from 'react'
import { shopCart } from './cartStore'

export { readProfile, saveProfile, type CartLine, type ShopProfile } from './cartStore'

export const useCartActions = () => shopCart.actions
export const useCart = () => useSyncExternalStore(shopCart.subscribe, shopCart.getSnapshot)
