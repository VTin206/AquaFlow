import { useState } from 'react'
import { Input, Segmented, Table, Tag, Typography } from 'antd'
import { Search } from 'lucide-react'
import { CountLabel } from '../../../shared/components/CountLabel'
import { QueryError } from '../../../shared/components/QueryError'
import { currency } from '../../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../../shared/utils/table'
import { useExpiryWarningDays } from '../../settings/settingsService'
import { daysUntilExpiry, isoToVnDate } from '../expiry'
import type { Lot } from '../types'
import { useLots, useProducts } from '../useProducts'

type LotFilter = 'stock' | 'expiring' | 'all'

const daysLeft = (lot: Lot) => (lot.expiryDate ? daysUntilExpiry(isoToVnDate(lot.expiryDate)) : null)

/** Tồn theo lô, sắp theo hạn dùng; lô hết hạn sớm được xuất trước (FEFO). */
export function LotsPanel() {
  const lotsQuery = useLots()
  const warningDays = useExpiryWarningDays()
  const { data: products = [] } = useProducts()
  const [filter, setFilter] = useState<LotFilter>('stock')
  const [query, setQuery] = useState('')
  const lots = lotsQuery.data ?? []
  const inStock = lots.filter((lot) => lot.remaining > 0)
  const expiring = inStock.filter((lot) => (daysLeft(lot) ?? Infinity) <= warningDays)
  const productOf = (id: string) => products.find((product) => product.id === id)
  const keyword = query.trim().toLowerCase()
  const visible = (filter === 'stock' ? inStock : filter === 'expiring' ? expiring : lots).filter((lot) =>
    `${lot.lotCode} ${productOf(lot.productId)?.name ?? ''} ${lot.receiptId}`.toLowerCase().includes(keyword),
  )

  if (lotsQuery.isError) return <QueryError error={lotsQuery.error} onRetry={lotsQuery.refetch} />

  return (
    <>
      <div className="af-toolbar">
        <Segmented<LotFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'stock', label: <CountLabel label="Còn hàng" count={inStock.length} /> },
            { value: 'expiring', label: <CountLabel label="Sắp hết hạn" count={expiring.length} urgent /> },
            { value: 'all', label: <CountLabel label="Tất cả lô" count={lots.length} /> },
          ]}
        />
        <Input allowClear prefix={<Search size={16} className="af-input-icon" />} placeholder="Tìm mã lô, sản phẩm, phiếu nhập..." value={query} onChange={(event) => setQuery(event.target.value)} className="af-search" />
      </div>
      <Table<Lot>
        className="af-data-table"
        size="middle"
        rowKey="id"
        loading={lotsQuery.isPending}
        dataSource={visible}
        pagination={tablePagination}
        scroll={{ x: 960, y: tableScrollHeight }}
        locale={{ emptyText: 'Không có lô phù hợp.' }}
        columns={[
          {
            title: 'Sản phẩm / mã lô',
            key: 'lot',
            render: (_, lot) => (
              <div className="af-cell-stack">
                <span className="af-cell-truncate" title={productOf(lot.productId)?.name}>{productOf(lot.productId)?.name ?? lot.productId}</span>
                <small>Lô {lot.lotCode}</small>
              </div>
            ),
          },
          { title: 'Ngày SX', dataIndex: 'mfgDate', width: 110, render: (date?: string) => (date ? isoToVnDate(date) : '—') },
          {
            title: 'Hạn dùng',
            dataIndex: 'expiryDate',
            width: 150,
            render: (_, lot) => {
              const days = daysLeft(lot)
              if (days === null) return <Typography.Text type="secondary">Không áp dụng</Typography.Text>
              return (
                <div className="af-cell-stack">
                  <span>{isoToVnDate(lot.expiryDate!)}</span>
                  <small className={days <= warningDays ? 'af-text-warning' : undefined}>{days < 0 ? 'Đã hết hạn' : `Còn ${days} ngày`}</small>
                </div>
              )
            },
          },
          {
            title: 'Còn / nhập',
            key: 'qty',
            width: 130,
            align: 'right',
            render: (_, lot) => (
              <span className="af-money">
                {lot.remaining} <Typography.Text type="secondary">/ {lot.received}</Typography.Text>
              </span>
            ),
          },
          { title: 'Giá vốn', dataIndex: 'costPrice', width: 120, align: 'right', render: (cost: number) => currency(cost) },
          {
            title: 'Nguồn',
            key: 'source',
            width: 150,
            render: (_, lot) => (
              <div className="af-cell-stack">
                <span>{lot.receiptId}</span>
                <small>{isoToVnDate(lot.receivedAt)}</small>
              </div>
            ),
          },
          {
            title: 'Xuất',
            key: 'state',
            width: 120,
            render: (_, lot) =>
              lot.remaining === 0 ? <Tag>Đã hết</Tag> : lot.id === inStock.find((item) => item.productId === lot.productId)?.id ? <Tag color="blue">Xuất trước</Tag> : <Tag color="default">Chờ</Tag>,
          },
        ]}
      />
    </>
  )
}
