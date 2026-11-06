import { useState, type ReactNode } from 'react'
import { App, Button, Card, Descriptions, Dropdown, Empty, Input, Modal, Segmented, Table, Tag, type TableColumnsType } from 'antd'
import { Ellipsis, Pencil, Plus, Search } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
import { MapLink } from '@/shared/address/MapLink'
import { modalWidth } from '@/shared/utils/modal'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { CountLabel } from '@/shared/components/CountLabel'
import { useColumnSort } from '@/shared/components/sortableColumn'
import { useFeature } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { tablePagination, tableScrollHeight } from '@/shared/utils/table'
import { SupplierFormModal } from './components/SupplierFormModal'
import type { SupplierStatus } from './supplierService'
import { useActivateSupplier, useCanManageSuppliers, useDeactivateSupplier, useSuppliers } from './useSuppliers'
import type { Supplier } from './types'
import { matchesSearch } from '@/shared/utils/search'

export function SuppliersPage() {
  const { message, modal } = App.useApp()
  const canManage = useCanManageSuppliers()
  const showContact = useFeature('supplierContactName')
  const showEmail = useFeature('supplierEmail')
  const [status, setStatus] = useState<SupplierStatus>('active')
  // Quản lý tải hết một lần rồi lọc tại chỗ để đếm được từng trạng thái; nhân viên chỉ xem nhà cung cấp đang dùng (BE cũng giới hạn như vậy).
  const suppliersQuery = useSuppliers(canManage ? 'all' : 'active')
  const deactivate = useDeactivateSupplier()
  const activate = useActivateSupplier()
  const canReactivate = useFeature('reactivate')
  const sort = useColumnSort<Supplier>()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<Supplier | null>()
  const [viewingId, setViewingId] = useState<string>()
  const keyword = query.trim()
  const allSuppliers = suppliersQuery.data ?? []
  const suppliers = status === 'all' ? allSuppliers : allSuppliers.filter((supplier) => supplier.active === (status === 'active'))
  const activeCount = allSuppliers.filter((supplier) => supplier.active).length
  // Đọc lại từ danh sách để sau khi sửa hoặc ngừng hợp tác, cửa sổ xem hiện ngay dữ liệu mới.
  const viewing = allSuppliers.find((supplier) => supplier.id === viewingId)
  const statusOptions: { value: SupplierStatus; label: ReactNode }[] = [
    { value: 'active', label: <CountLabel label="Đang hợp tác" count={activeCount} tone="success" /> },
    { value: 'inactive', label: <CountLabel label="Ngừng hợp tác" count={allSuppliers.length - activeCount} tone="danger" /> },
    { value: 'all', label: <CountLabel label="Tất cả" count={allSuppliers.length} /> },
  ]
  const visible = suppliers.filter((supplier) =>
    matchesSearch(
      query,
      [supplier.code, supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.address].join(' '),
      supplier.phone ?? '',
    ),
  )

  // Ngừng hợp tác ít khi dùng nên nằm trong menu ⋯; hộp xác nhận nói rõ hậu quả thay vì tô đỏ.
  const confirmStop = (supplier: Supplier) =>
    modal.confirm({
      title: 'Ngừng hợp tác?',
      content: (
        <div className="af-confirm-body">
          <p>
            <strong>{supplier.name}</strong> sẽ không chọn được khi tạo phiếu nhập mới.
          </p>
          <p>Phiếu nhập cũ vẫn giữ nguyên.</p>
        </div>
      ),
      centered: true,
      okText: 'Ngừng hợp tác',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: () =>
        deactivate.mutateAsync(supplier.id).then(
          () => {
            message.success(`Đã ngừng hợp tác với ${supplier.name}.`)
          },
          (error: Error) => {
            message.error(error.message)
          },
        ),
    })

  const reactivate = (supplier: Supplier) =>
    activate.mutateAsync(supplier.id).then(
      () => {
        message.success(`Đã hợp tác lại với ${supplier.name}.`)
      },
      (error: Error) => {
        message.error(error.message)
      },
    )
  const rowMenu = (supplier: Supplier) =>
    supplier.active
      ? [{ key: 'stop', label: 'Ngừng hợp tác', danger: true, disabled: deactivate.isPending, onClick: () => confirmStop(supplier) }]
      : [
          {
            key: 'resume',
            label: 'Hợp tác lại',
            disabled: !canReactivate || activate.isPending,
            extra: canReactivate ? undefined : 'Chưa hỗ trợ',
            onClick: () => void reactivate(supplier),
          },
        ]

  const columns: TableColumnsType<Supplier> = [
    {
      ...sort.column('Nhà cung cấp', 'name', 'text'),
      dataIndex: 'name',
      width: 380,
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, supplier) => (
        <div className="af-cell-stack">
          <span className="af-name-with-tag">
            <span className="af-cell-truncate" title={supplier.name}>
              {supplier.name}
            </span>
            {!supplier.active && <Tag className="af-inactive-tag">Ngừng hợp tác</Tag>}
          </span>
          <small>{supplier.code}</small>
        </div>
      ),
    },
    {
      title: 'Liên hệ',
      dataIndex: 'phone',
      width: 190,
      render: (_, supplier) => (
        <div className="af-cell-stack">
          {showContact ? (
            <span className="af-cell-truncate" title={supplier.contactName}>
              {supplier.contactName || 'Chưa có người liên hệ'}
            </span>
          ) : (
            <Unsupported label="Người liên hệ: chưa hỗ trợ" />
          )}
          <small>{supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : 'Chưa có số điện thoại'}</small>
          {/* Email là một cách liên hệ nên nằm chung cột, không tách cột riêng. */}
          {showEmail && supplier.email && (
            <small className="af-cell-truncate" title={supplier.email}>
              <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
            </small>
          )}
        </div>
      ),
    },
    { title: 'Địa chỉ', dataIndex: 'address', width: 280, ellipsis: true, render: (address?: string) => address || '—' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 112,
      align: 'center' as const,
      fixed: 'right' as const,
      // Sửa và ngừng hợp tác ít dùng: xem trước, các nút nằm trong cửa sổ chi tiết.
      render: (_: unknown, supplier: Supplier) => <ViewButton subject={supplier.name} onClick={() => setViewingId(supplier.id)} />,
    },
  ]

  return (
    <Page
      title="Nhà cung cấp"
      description="Quản lý thông tin và đầu mối liên hệ của các đơn vị cung cấp hàng."
      actions={
        canManage ? (
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Thêm nhà cung cấp
          </Button>
        ) : undefined
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {suppliersQuery.isError ? (
          <QueryError error={suppliersQuery.error} onRetry={suppliersQuery.refetch} />
        ) : (
          <>
            <div className="af-toolbar">
              {canManage ? (
                <Segmented<SupplierStatus>
                  value={status}
                  onChange={(next) => {
                    setStatus(next)
                    setPage(1)
                  }}
                  options={statusOptions}
                />
              ) : (
                <span className="af-toolbar-title">
                  <CountLabel label="Danh sách nhà cung cấp" count={suppliers.length} />
                </span>
              )}
              <Input
                allowClear
                className="af-search"
                prefix={<Search size={16} className="af-input-icon" />}
                aria-label="Tìm nhà cung cấp"
                placeholder="Tìm tên, mã, số điện thoại..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Table<Supplier>
              className="af-data-table af-table-flush"
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={visible}
              loading={suppliersQuery.isPending}
              pagination={{
                ...tablePagination,
                current: page,
                pageSize,
                onChange: (nextPage, nextSize) => {
                  setPage(nextSize === pageSize ? nextPage : 1)
                  setPageSize(nextSize)
                },
              }}
              rowClassName={(supplier) => (supplier.active ? '' : 'af-row-inactive')}
              scroll={{ x: 962, y: tableScrollHeight }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      keyword
                        ? 'Không tìm thấy nhà cung cấp phù hợp.'
                        : status === 'inactive'
                          ? 'Không có nhà cung cấp đã ngừng hợp tác.'
                          : 'Chưa có nhà cung cấp nào.'
                    }
                  >
                    {keyword ? (
                      <Button
                        onClick={() => {
                          setQuery('')
                          setPage(1)
                        }}
                      >
                        Xóa tìm kiếm
                      </Button>
                    ) : (
                      canManage &&
                      status !== 'inactive' && (
                        <Button type="primary" onClick={() => setEditing(null)}>
                          Thêm nhà cung cấp
                        </Button>
                      )
                    )}
                  </Empty>
                ),
              }}
            />
          </>
        )}
      </Card>
      <Modal
        open={viewing !== undefined}
        centered
        width={modalWidth.small}
        onCancel={() => setViewingId(undefined)}
        title={
          <span className="af-name-with-tag">
            {viewing?.name}
            {viewing && !viewing.active && <Tag className="af-inactive-tag">Ngừng hợp tác</Tag>}
          </span>
        }
        footer={
          canManage && viewing ? (
            <div className="af-order-footer">
              <div>
                <Dropdown trigger={['click']} menu={{ items: rowMenu(viewing) }}>
                  <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
                </Dropdown>
              </div>
              <div>
                <Button type="primary" icon={<Pencil size={15} />} onClick={() => setEditing(viewing)}>
                  Sửa thông tin
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setViewingId(undefined)}>Đóng</Button>
          )
        }
      >
        {viewing && (
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'code', label: 'Mã', children: viewing.code },
              ...(showContact ? [{ key: 'contact', label: 'Người liên hệ', children: viewing.contactName || '—' }] : []),
              { key: 'phone', label: 'Điện thoại', children: viewing.phone ? <a href={`tel:${viewing.phone}`}>{viewing.phone}</a> : '—' },
              ...(showEmail
                ? [
                    {
                      key: 'email',
                      label: 'Email',
                      children: viewing.email ? <a href={`mailto:${viewing.email}`}>{viewing.email}</a> : '—',
                    },
                  ]
                : []),
              {
                key: 'address',
                label: 'Địa chỉ',
                children: viewing.address ? (
                  <span>
                    {viewing.address}
                    <MapLink address={viewing.address} />
                  </span>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        )}
      </Modal>
      {editing !== undefined && (
        <SupplierFormModal
          key={editing?.id ?? 'new'}
          supplier={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            if (!editing) {
              setQuery('')
              setPage(1)
            }
          }}
        />
      )}
    </Page>
  )
}
