import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Alert, App, Button, Collapse, Descriptions, Dropdown, Modal, Popconfirm, Skeleton, Table, Tag, type CollapseProps } from 'antd'
import { Ellipsis } from 'lucide-react'
import { OrderTotals } from '@/shared/components/OrderTotals'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useStaff } from '@/features/auth/useStaff'
import { tripLabels } from '@/features/delivery/deliveryApi'
import { catalogApi } from './catalogApi'
import {
  canCancel,
  canConfirm,
  canPrepare,
  confirmOrderHint,
  orderApi,
  orderStatusLabels,
  paymentStatusLabels,
  channelLabels,
  type OrderStatus,
} from './orderApi'
import { invalidateLiveData } from './invalidateLiveData'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'
import { canDispatch, dispatchApi } from './dispatchApi'
import { OrderProgress } from '@/features/orders/OrderProgress'
import { OrderDeliveryHistory } from '@/features/orders/OrderDeliveryHistory'
import { OrderFocusBanner, OrderLines, OrderParty } from '@/features/orders/components/OrderSheet'
import { fromLiveOrder } from '@/features/orders/orderData'
import { liveOrderFocus } from '@/features/orders/orderFocus'
import { DeliverySlipDocument, InvoiceDocument } from '@/features/orders/print/OrderDocuments'
import { useCopyOrderMessage } from '@/features/orders/useCopyOrderMessage'
import { useOrderDeliveryHistory } from '@/features/orders/useOrderDeliveryHistory'
import { useSettings } from '@/features/settings/settingsService'
import { usePrinter } from '@/shared/print/usePrinter'

const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')
const statusColors: Record<OrderStatus, string> = {
  PENDING: 'gold',
  CONFIRMED: 'blue',
  PREPARING: 'blue',
  OUT_FOR_DELIVERY: 'cyan',
  DELIVERED: 'green',
  COMPLETED: 'green',
  CANCELLED: 'default',
}

/** Màu trạng thái thanh toán theo quy ước tiền: cam còn phải thu, xanh đã thu, đỏ đang hoàn. */
const paymentTagColors: Record<keyof typeof paymentStatusLabels, string> = {
  UNPAID: 'orange',
  PARTIALLY_PAID: 'orange',
  PAID: 'green',
  REFUND_PENDING: 'red',
  REFUNDED: 'default',
}

/**
 * Chi tiết đơn, sắp theo thứ tự người dùng cần: đơn đang cần gì → ai nhận, hàng gì, bao nhiêu tiền → một hành động chính.
 * Giao hàng, xuất kho và thông tin phụ gập lại, chỉ hiện tóm tắt cho tới khi cần xem.
 */
export function LiveOrderDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const staff = useStaff()
  const canManage = staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF'
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['live', 'order', staff?.name, staff?.role, id],
    queryFn: () => orderApi.detail(id),
    enabled: canManage,
    refetchInterval: 15000,
  })
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const receipts = useQuery({
    queryKey: ['live', 'dispatches', staff?.name, staff?.role, id],
    queryFn: () => dispatchApi.list(id),
    enabled: canManage,
    refetchInterval: 15000,
  })
  const { allowed: canSeeTrips, query: trips } = useOrderDeliveryHistory(id)
  const update = useMutation({
    mutationFn: (status: 'CONFIRMED' | 'PREPARING' | 'CANCELLED') => orderApi.updateStatus(id, status),
    onSuccess: (order) => {
      void invalidateLiveData(queryClient)
      message.success(
        order.status === 'CONFIRMED'
          ? `Đã xác nhận đơn ${order.orderCode} và giữ hàng trong kho.`
          : order.status === 'PREPARING'
            ? `Đơn ${order.orderCode} chuyển sang "Đang chuẩn bị".`
            : `Đã hủy đơn ${order.orderCode}.`,
      )
    },
    // Đơn có thể đã đổi trạng thái ở nơi khác (409): tải lại để hiện trạng thái mới.
    onError: (error: Error) => {
      void invalidateLiveData(queryClient)
      message.error(error.message)
    },
  })
  const printer = usePrinter()
  const copyMessage = useCopyOrderMessage()
  const { data: settings } = useSettings()
  const order = query.data
  // Chưa tải được danh mục thì vẫn hiện đơn với mã sản phẩm, nhưng chưa cho in để chứng từ không thiếu tên hàng.
  const viewOrder = order ? fromLiveOrder(order, catalog.data ?? []) : undefined
  const canPrint = Boolean(catalog.data && settings)
  const lastAttempt = trips.data?.at(-1)?.assignment.latestAttempt
  const lastTrip = trips.data?.at(-1)?.trip

  const moreMenu =
    viewOrder && viewOrder.status !== 'Đã hủy' ? (
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'copy', label: 'Sao chép tin nhắn xác nhận', onClick: () => void copyMessage(viewOrder, settings?.storeName) },
            {
              key: 'invoice',
              label: 'In hóa đơn bán lẻ',
              disabled: !canPrint,
              onClick: () => printer.print(<InvoiceDocument order={viewOrder} settings={settings} />),
            },
            ...(viewOrder.method === 'Giao tận nơi'
              ? [
                  {
                    key: 'slip',
                    label: 'In phiếu giao hàng',
                    disabled: !canPrint,
                    onClick: () => printer.print(<DeliverySlipDocument order={viewOrder} settings={settings} />),
                  },
                ]
              : []),
          ],
        }}
      >
        <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
      </Dropdown>
    ) : null

  const primaryAction =
    order && canManage ? (
      canConfirm(order) ? (
        <Popconfirm
          title={`Xác nhận đơn ${order.orderCode}?`}
          description={confirmOrderHint}
          okText="Xác nhận"
          cancelText="Chưa"
          onConfirm={() => update.mutate('CONFIRMED')}
        >
          <Button type="primary" loading={update.isPending && update.variables === 'CONFIRMED'} disabled={update.isPending}>
            Xác nhận đơn
          </Button>
        </Popconfirm>
      ) : canPrepare(order) ? (
        <Popconfirm
          title={`Chuẩn bị hàng cho đơn ${order.orderCode}?`}
          description={
            order.fulfillmentType === 'DELIVERY'
              ? 'Đơn chuyển sang "Đang chuẩn bị" để soạn hàng trước khi xuất giao.'
              : 'Đơn chuyển sang "Đang chuẩn bị" để soạn hàng cho khách.'
          }
          okText="Chuẩn bị"
          cancelText="Chưa"
          onConfirm={() => update.mutate('PREPARING')}
        >
          <Button type="primary" loading={update.isPending && update.variables === 'PREPARING'} disabled={update.isPending}>
            Chuẩn bị hàng
          </Button>
        </Popconfirm>
      ) : canDispatch(order) ? (
        <Link to="/delivery" onClick={onClose}>
          <Button type="primary" disabled={update.isPending}>
            Xếp chuyến
          </Button>
        </Link>
      ) : null
    ) : null

  const cancelAction =
    order && canManage && canCancel(order) ? (
      <Popconfirm
        title={`Hủy đơn ${order.orderCode}?`}
        description={order.status === 'PENDING' ? 'Đơn chưa giữ hàng nên không ảnh hưởng tồn kho.' : 'Hàng đã giữ cho đơn sẽ được trả lại tồn kho.'}
        okText="Hủy đơn"
        okButtonProps={{ danger: true }}
        cancelText="Không"
        onConfirm={() => update.mutate('CANCELLED')}
      >
        <Button type="text" danger loading={update.isPending && update.variables === 'CANCELLED'} disabled={update.isPending}>
          Hủy đơn
        </Button>
      </Popconfirm>
    ) : null

  const productName = (productId: number) => catalog.data?.find((product) => product.id === productId)?.name ?? `Sản phẩm #${productId}`
  const moreSections: CollapseProps['items'] = order
    ? [
        ...(order.fulfillmentType === 'DELIVERY' && canSeeTrips
          ? [
              {
                key: 'delivery',
                label: 'Giao hàng',
                extra: lastTrip
                  ? `Chuyến #${lastTrip.id} · ${tripLabels[lastTrip.status]}`
                  : trips.isSuccess
                    ? canCancel(order)
                      ? 'Chưa xếp chuyến'
                      : 'Không thuộc chuyến nào'
                    : undefined,
                children: <OrderDeliveryHistory orderId={id} />,
              },
            ]
          : []),
        {
          key: 'stock',
          label: 'Xuất kho',
          extra: receipts.data ? (receipts.data.length ? `${receipts.data.length} phiếu` : 'Chưa xuất') : undefined,
          children: receipts.isError ? (
            <QueryError error={receipts.error} onRetry={receipts.refetch} />
          ) : receipts.isPending ? (
            <Skeleton active />
          ) : !receipts.data.length ? (
            <p className="af-order-more-empty">Đơn chưa có phiếu xuất kho.</p>
          ) : (
            receipts.data.map((receipt) => (
              <div key={receipt.id} className="af-order-receipt">
                <p>
                  <strong>Phiếu xuất #{receipt.id}</strong> · {dateTime(receipt.dispatchedAt)}
                </p>
                <Table
                  rowKey={(line) => `${line.orderItemId}-${line.batchId}`}
                  size="small"
                  dataSource={receipt.items}
                  pagination={false}
                  scroll={{ x: 450 }}
                  columns={[
                    { title: 'Sản phẩm', dataIndex: 'productId', render: productName },
                    { title: 'Lô', dataIndex: 'lotCode' },
                    { title: 'Hạn dùng', dataIndex: 'expiresOn' },
                    { title: 'Đã xuất', dataIndex: 'quantity', align: 'right' },
                  ]}
                />
              </div>
            ))
          ),
        },
        {
          key: 'info',
          label: 'Thông tin đơn',
          extra: channelLabels[order.channel] ?? order.channel,
          children: (
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: 'channel', label: 'Kênh', children: channelLabels[order.channel] ?? order.channel },
                { key: 'created', label: 'Ngày tạo', children: dateTime(order.createdAt) },
                ...(order.confirmedAt ? [{ key: 'confirmed', label: 'Xác nhận lúc', children: dateTime(order.confirmedAt) }] : []),
                ...(order.cancelledAt ? [{ key: 'cancelled', label: 'Hủy lúc', children: dateTime(order.cancelledAt) }] : []),
              ]}
            />
          ),
        },
      ]
    : []

  return (
    <Modal
      open
      width={modalWidth.medium}
      styles={modalScrollBody}
      onCancel={onClose}
      title={
        <span className="af-order-title">
          <span>{order ? `Đơn ${order.orderCode}` : 'Chi tiết đơn hàng'}</span>
          {order && <Tag color={statusColors[order.status]}>{orderStatusLabels[order.status] ?? order.status}</Tag>}
        </span>
      }
      footer={
        order ? (
          <div className="af-order-footer">
            <div>{cancelAction}</div>
            <div>
              {moreMenu}
              {primaryAction}
            </div>
          </div>
        ) : null
      }
    >
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : !order || !viewOrder ? (
        <Skeleton active />
      ) : (
        <>
          <OrderFocusBanner
            focus={liveOrderFocus(
              order,
              lastAttempt?.outcome === 'FAILED' ? (lastAttempt.failureReason ?? null) : undefined,
              order.fulfillmentType === 'DELIVERY' && trips.isSuccess && !trips.data.length,
            )}
          />
          {order.status !== 'CANCELLED' && <OrderProgress order={order} showStatus={false} />}
          {catalog.isError && (
            <Alert
              type="warning"
              title="Không tải được tên sản phẩm; đang hiển thị mã định danh."
              action={<Button onClick={() => void catalog.refetch()}>Thử lại</Button>}
              style={{ marginBottom: 16 }}
            />
          )}
          <div className="af-order-sheet">
            <OrderParty order={viewOrder} />
            <OrderLines lines={viewOrder.lines}>
              <OrderTotals
                wide
                rows={[
                  { label: 'Tiền hàng', value: currency(order.subtotal) },
                  ...(Number(order.discountAmount) > 0 ? [{ label: 'Giảm giá', value: `−${currency(order.discountAmount)}` }] : []),
                  ...(order.fulfillmentType === 'DELIVERY'
                    ? [{ label: 'Phí giao', value: Number(order.deliveryFee) > 0 ? currency(order.deliveryFee) : 'Miễn phí' }]
                    : []),
                ]}
                total={{ label: 'Tổng cộng', value: currency(order.total) }}
                after={
                  order.status !== 'CANCELLED' && (
                    <div className="is-status">
                      <Tag color={paymentTagColors[order.paymentStatus]}>
                        {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
                      </Tag>
                    </div>
                  )
                }
              />
            </OrderLines>
          </div>
          <Collapse ghost className="af-order-more" items={moreSections} />
        </>
      )}
      {printer.portal}
    </Modal>
  )
}
