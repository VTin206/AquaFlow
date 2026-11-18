import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ShopIntro } from './components/ShopIntro'
import { useShopContact, useShopProducts } from './shopService'

export function ShopPage() {
  const navigate = useNavigate()
  const productsQuery = useShopProducts()
  const contact = useShopContact()

  useEffect(() => {
    document.title = `Trang chủ | ${contact?.storeName ?? 'AquaFlow'}`
  }, [contact?.storeName])

  const products = productsQuery.data ?? []

  return (
    <div className="af-shop-page">
      <ShopIntro
        phone={contact?.phone}
        products={products}
        onShop={() => navigate('/shop/drinks')}
      />
    </div>
  )
}
