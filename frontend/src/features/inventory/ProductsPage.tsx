import { useState } from 'react'
import { Button, Card, Col, Empty, Input, Row, Skeleton, Tag, Typography } from 'antd'
import { Droplets, Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { ProductFormModal } from './components/ProductFormModal'
import { isLowStock } from './types'
import { useProducts } from './useProducts'

export function ProductsPage() {
  const productsQuery = useProducts()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const keyword = query.trim().toLowerCase()
  const visible = (productsQuery.data ?? []).filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(keyword))

  const renderBody = () => {
    if (productsQuery.isError) return <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
    if (productsQuery.isPending) return <Skeleton active paragraph={{ rows: 6 }} />
    if (visible.length === 0) {
      return (
        <Empty description={keyword ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm nào.'}>
          {!keyword && (
            <Button type="primary" onClick={() => setCreating(true)}>
              Thêm sản phẩm đầu tiên
            </Button>
          )}
        </Empty>
      )
    }
    return (
      <Row gutter={[16, 16]}>
        {visible.map((product) => (
          <Col key={product.id} xs={12} md={8} xl={6}>
            <Card
              hoverable
              className="af-product-card"
              cover={
                product.image ? (
                  <img src={product.image} alt={product.name} className="af-product-image" />
                ) : (
                  <div className="af-product-placeholder" aria-hidden>
                    <Droplets size={32} strokeWidth={1.5} />
                  </div>
                )
              }
            >
              <Typography.Text type="secondary" className="af-product-sku">
                {product.sku} · {product.brand}
              </Typography.Text>
              <Typography.Title level={5} className="af-product-name">
                {product.name}
              </Typography.Title>
              <div className="af-product-footer">
                <span className="af-money">
                  {currency(product.price)}
                  <Typography.Text type="secondary"> / {product.unit.toLowerCase()}</Typography.Text>
                </span>
                <Tag color={isLowStock(product) ? 'red' : 'default'}>Còn {product.stock}</Tag>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  return (
    <Page
      title="Sản phẩm"
      description="Danh mục hàng hóa và giá bán hiện tại."
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Thêm sản phẩm
        </Button>
      }
    >
      <Card className="af-card">
        <div className="af-toolbar af-toolbar-plain">
          <Typography.Text type="secondary">{visible.length} sản phẩm</Typography.Text>
          <Input
            allowClear
            prefix={<Search size={16} className="af-input-icon" />}
            placeholder="Tìm tên, mã hàng, thương hiệu..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="af-search"
          />
        </div>
        {renderBody()}
      </Card>
      <ProductFormModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}
