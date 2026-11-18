import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Button, Input, Modal, Tooltip } from 'antd'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { navGroups } from '@/app/navigation'
import { canOpen } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { useCustomerSearch } from '@/features/customers/useCustomers'
import { customerCode } from '@/features/customers/types'
import { useCanManageProducts, useCatalog } from '@/features/inventory/useProductCatalog'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { useOrderPage } from '@/features/orders/orderData'
import { ALL_ORDERS } from '@/features/orders/useOrderFilters'
import { matchesSearch } from '@/shared/utils/search'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { modalWidth } from '@/shared/utils/modal'

const GROUP_LIMIT = 5

type Hit = { key: string; group: string; title: string; detail?: string; run: () => void }

/** Chỉ gắn khi hộp tìm mở để không tải dữ liệu lúc chưa cần. */
function SearchPanel({ onClose, onOpenOrder }: { onClose: () => void; onOpenOrder: (id: string) => void }) {
  const navigate = useNavigate()
  const staff = useStaff()
  const canManageProducts = useCanManageProducts()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const keyword = query.trim()
  // Đơn và khách tìm ở BE trên toàn bộ dữ liệu (kể cả đơn cũ), chờ ngừng gõ rồi mới gửi.
  const searched = useDebouncedValue(keyword)
  const orderFilters = useMemo(
    () => ({ query: searched, group: 'all' as const, status: ALL_ORDERS, method: ALL_ORDERS, payment: ALL_ORDERS }),
    [searched],
  )
  const orders = useOrderPage(orderFilters, 0, GROUP_LIMIT)
  const customers = useCustomerSearch(searched, GROUP_LIMIT)
  const products = useCatalog(canManageProducts ? 'all' : 'active')

  const go = (path: string) => {
    navigate(path)
    onClose()
  }
  const top = <T,>(items: T[], matches: (item: T) => boolean) => items.filter(matches).slice(0, GROUP_LIMIT)
  // Kết quả BE đã khớp từ khóa; chỉ hiện khi khớp với từ khóa đang gõ để không lộ kết quả cũ.
  const settled = searched === keyword

  const pages: Hit[] = navGroups
    .flatMap((group) => group.items)
    .filter((item) => !staff || canOpen(staff.role, item.path))
    .filter((item) => matchesSearch(keyword, item.label))
    .map((item) => ({ key: `page:${item.path}`, group: 'Trang', title: item.label, run: () => go(item.path) }))
  const records: Hit[] = !keyword
    ? []
    : [
        ...(settled ? (orders.data?.orders ?? []).slice(0, GROUP_LIMIT) : []).map(
          (order): Hit => ({
            key: `order:${order.id}`,
            group: 'Đơn hàng',
            title: `${order.code ?? order.id} · ${order.customer}`,
            detail: order.status,
            run: () => onOpenOrder(order.id),
          }),
        ),
        ...(settled ? (customers.data?.customers ?? []) : []).map(
          (customer): Hit => ({
            key: `customer:${customer.id}`,
            group: 'Khách hàng',
            title: customer.name,
            detail: customer.phone,
            run: () => go(`/customers?q=${encodeURIComponent(customerCode(customer))}`),
          }),
        ),
        ...top(products.data ?? [], (product) => product.active && matchesSearch(keyword, `${product.sku} ${product.name}`)).map(
          (product): Hit => ({
            key: `product:${product.id}`,
            group: 'Sản phẩm',
            title: product.name,
            detail: product.sku,
            run: () => go(`/products?q=${encodeURIComponent(product.name)}`),
          }),
        ),
      ]
  const hits = [...records, ...pages]
  const current = Math.min(active, Math.max(hits.length - 1, 0))
  const loading = Boolean(keyword) && (!settled || orders.isPending || customers.isPending || products.isPending)
  const failed = Boolean(keyword) && (orders.isError || customers.isError || products.isError)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (hits.length) setActive((current + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length)
    } else if (event.key === 'Enter') {
      hits[current]?.run()
    }
  }

  return (
    <div className="af-global-search">
      <Input
        autoFocus
        size="large"
        prefix={<Search size={18} className="af-input-icon" />}
        placeholder="Tìm đơn hàng, khách hàng, sản phẩm hoặc trang..."
        aria-label="Tìm nhanh"
        aria-controls="af-global-search-results"
        aria-activedescendant={hits[current] ? `af-hit-${current}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="af-global-search-results" role="listbox" aria-label="Kết quả tìm kiếm">
        {hits.map((hit, index) => (
          <li key={hit.key} id={`af-hit-${index}`} role="option" aria-selected={index === current}>
            <button type="button" className={index === current ? 'is-active' : undefined} onClick={hit.run} onMouseEnter={() => setActive(index)}>
              <small>{hit.group}</small>
              <span className="af-cell-truncate">{hit.title}</span>
              {hit.detail && <small>{hit.detail}</small>}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="af-global-search-note">
        {loading
          ? 'Đang tải dữ liệu…'
          : failed
            ? 'Một phần dữ liệu không tải được nên kết quả có thể thiếu.'
            : hits.length === 0
              ? 'Không tìm thấy kết quả phù hợp.'
              : '↑↓ để chọn · Enter để mở · Esc để đóng'}
      </p>
    </div>
  )
}

/** Nút và phím tắt Ctrl+K (⌘K trên Mac) mở hộp tìm nhanh trong khu quản lý. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <Tooltip title="Tìm nhanh (Ctrl+K)">
        <Button type="text" className="af-topbar-icon" aria-label="Tìm nhanh" icon={<Search size={19} />} onClick={() => setOpen(true)} />
      </Tooltip>
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} closable={false} width={modalWidth.small} destroyOnHidden title={null}>
        {open && (
          <SearchPanel
            onClose={() => setOpen(false)}
            onOpenOrder={(id) => {
              setOrderId(id)
              setOpen(false)
            }}
          />
        )}
      </Modal>
      {orderId !== null && <OrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
