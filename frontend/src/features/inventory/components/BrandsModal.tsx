import { useState } from 'react'
import { Button, Input, Modal, Table, Tooltip } from 'antd'
import { Pencil, Plus, Search } from 'lucide-react'
import { modalFixedBody, modalFixedWidth } from '@/shared/utils/modal'
import { modalTableScrollHeight } from '@/shared/utils/table'
import { UNSUPPORTED_HINT } from '@/shared/components/Unsupported'
import { normalizeSearch } from '../catalogGroups'
import { brandRows, type BrandRow } from '../brandRows'
import type { CatalogItem } from '../useProductCatalog'

/**
 * Quản lý thương hiệu. Backend chưa lưu thương hiệu riêng (chỉ là chữ trên sản phẩm),
 * nên hiện danh sách để xem; thêm/sửa giữ chỗ và báo "Chưa hỗ trợ".
 */
export function BrandsModal({ products, onClose }: { products: Pick<CatalogItem, 'brand'>[]; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const keyword = normalizeSearch(search.trim())
  const rows = brandRows(products).filter((row) => normalizeSearch(`${row.name} ${row.aliases.join(' ')}`).includes(keyword))
  return (
    <Modal open centered title="Thương hiệu" width={modalFixedWidth} styles={modalFixedBody} onCancel={onClose} footer={null}>
      <div className="af-modal-toolbar">
        <Input
          aria-label="Tìm thương hiệu"
          prefix={<Search size={16} className="af-input-icon" />}
          placeholder="Tìm tên thương hiệu"
          value={search}
          allowClear
          onChange={(event) => setSearch(event.target.value)}
        />
        <Tooltip title={UNSUPPORTED_HINT}>
          <Button className="af-modal-toolbar-end" type="primary" icon={<Plus size={16} />} disabled>
            Thêm thương hiệu
          </Button>
        </Tooltip>
      </div>
      <Table<BrandRow>
        rowKey="name"
        className="af-modal-table af-modal-table-fixed"
        dataSource={rows}
        size="small"
        pagination={false}
        scroll={{ y: modalTableScrollHeight }}
        locale={{ emptyText: 'Không có thương hiệu phù hợp.' }}
        columns={[
          {
            title: 'Thương hiệu',
            dataIndex: 'name',
            render: (name: string, row) => (
              <span className="af-brand-cell">
                {row.logo ? <img src={row.logo} alt="" /> : <span className="af-brand-cell-empty" aria-hidden />}
                {name}
              </span>
            ),
          },
          {
            title: 'Tên gọi khác',
            dataIndex: 'aliases',
            render: (aliases: string[], row) =>
              aliases.filter((alias) => alias !== row.name.toLowerCase()).join(', ') || <span className="af-text-muted">—</span>,
          },
          { title: 'Số sản phẩm', dataIndex: 'count', width: 120, align: 'right' },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 90,
            align: 'center',
            render: (_, row) => (
              <Tooltip title={UNSUPPORTED_HINT}>
                <Button size="small" icon={<Pencil size={15} />} aria-label={`Sửa ${row.name}`} disabled />
              </Tooltip>
            ),
          },
        ]}
      />
    </Modal>
  )
}
