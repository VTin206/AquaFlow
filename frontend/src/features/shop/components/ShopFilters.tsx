import type { Ref } from 'react'
import { Button, Input, Select, Typography, type InputRef } from 'antd'
import { Droplets, FunnelX, LayoutGrid, Search } from 'lucide-react'
import { brandGroups, catalogCategories, normalizeSearch } from '@/features/inventory/catalog'
import { ALL, brandOf, categoryOf, countBy, emptyFilters, shopGroups, type ShopFilterState } from '../shopGroups'
import type { ShopProduct } from '../shopService'

type Props = {
  products: ShopProduct[]
  filters: ShopFilterState
  visibleCount: number
  onChange: (next: Partial<ShopFilterState>) => void
  searchRef?: Ref<InputRef>
}

/** Bộ lọc trang khách, cùng bố cục với trang Sản phẩm bên quản lý: thương hiệu, tìm kiếm, loại nước, quy cách. */
export function ShopFilters({ products, filters, visibleCount, onChange, searchRef }: Props) {
  // Vỏ bình không thuộc thương hiệu nước nào nên không lên hàng logo.
  const brands = [...new Set(products.filter((product) => product.catalog?.packaging !== 'Vỏ bình').map(brandOf))]
    .map((name) => ({
      name,
      logo: brandGroups.find((group) => group.name === name)?.logo ?? products.find((product) => brandOf(product) === name)?.image,
      count: countBy(products, filters, 'brand', (product) => brandOf(product) === name),
    }))
    .sort((a, b) => b.count - a.count)
  const categories = [...new Set(products.map(categoryOf))].sort((a, b) => catalogCategories.indexOf(a) - catalogCategories.indexOf(b))
  const groups = shopGroups.map((item) => ({ key: item.key, label: item.label, count: countBy(products, filters, 'group', item.match) }))
  const hasFilters = filters.brand !== ALL || filters.group !== ALL || filters.category !== ALL || filters.query.trim() !== ''
  const brandValue = filters.brand === ALL ? undefined : filters.brand

  return (
    <div className="af-shop-filters">
      <div className="af-catalog-heading">
        <strong>Thương hiệu</strong>
        <Select
          className="af-brand-select"
          aria-label="Chọn thương hiệu"
          placeholder="Tất cả thương hiệu"
          allowClear
          showSearch={{ filterOption: (input, option) => normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)) }}
          value={brandValue}
          options={brands.map((item) => ({ value: item.name, label: `${item.name} (${item.count})` }))}
          onChange={(value) => onChange({ brand: value ?? ALL })}
        />
      </div>
      <div className="af-brand-filters" role="group" aria-label="Lọc theo thương hiệu">
        <button type="button" className={`af-brand-filter${filters.brand === ALL ? ' is-active' : ''}`} aria-pressed={filters.brand === ALL} onClick={() => onChange({ brand: ALL })}>
          <LayoutGrid size={25} aria-hidden />
          <span>Tất cả <small>{countBy(products, filters, 'brand', () => true)}</small></span>
        </button>
        {brands.map((item) => (
          <button
            type="button"
            key={item.name}
            className={`af-brand-filter${filters.brand === item.name ? ' is-active' : ''}`}
            aria-pressed={filters.brand === item.name}
            onClick={() => onChange({ brand: filters.brand === item.name ? ALL : item.name })}
          >
            {item.logo ? <img src={item.logo} alt="" /> : <Droplets size={25} aria-hidden />}
            <span>{item.name} <small>{item.count}</small></span>
          </button>
        ))}
      </div>
      <div className="af-catalog-filters">
        <Input ref={searchRef} aria-label="Tìm sản phẩm" allowClear prefix={<Search size={16} className="af-input-icon" />} placeholder="Tìm tên sản phẩm, thương hiệu..." value={filters.query} onChange={(event) => onChange({ query: event.target.value })} />
        <Select
          aria-label="Loại nước"
          allowClear
          placeholder="Tất cả loại nước"
          value={filters.category === ALL ? undefined : filters.category}
          options={categories.map((value) => ({ value, label: `${value} (${countBy(products, filters, 'category', (product) => categoryOf(product) === value)})` }))}
          onChange={(value) => onChange({ category: value ?? ALL })}
        />
        <Select
          aria-label="Quy cách"
          allowClear
          placeholder="Tất cả quy cách"
          value={filters.group === ALL ? undefined : filters.group}
          options={groups.map((item) => ({ value: item.key, label: `${item.label} (${item.count})`, disabled: item.count === 0 }))}
          onChange={(value) => onChange({ group: value ?? ALL })}
        />
      </div>
      <div className="af-catalog-results">
        <Typography.Text type="secondary">Hiển thị {visibleCount} sản phẩm{brandValue ? ` · ${brandValue}` : ''}</Typography.Text>
        {hasFilters && <Button type="link" size="small" className="af-clear-filter" icon={<FunnelX size={14} />} onClick={() => onChange(emptyFilters)}>Xóa bộ lọc</Button>}
      </div>
    </div>
  )
}
