import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Alert, App, Button, Descriptions, Popconfirm, Skeleton, Table, Tag, Timeline, Typography, type CollapseProps, type MenuProps } from 'antd'
import { Money } from '@/shared/components/Money'
import { OrderTotals } from '@/shared/components/OrderTotals'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { dueTone } from '@/shared/utils/money'
import { useStaff } from '@/features/auth/useStaff'
import { tripLabels } from '@/features/delivery/deliveryApi'
import { catalogApi } from './catalogApi'
import {
  canCancel,
  canConfirm,
  canPrepare,
  confirmOrderHint,
  orderApi,
  paymentStatusLabels,
  channelLabels,
} from './orderApi'
import { invalidateLiveData } from './invalidateLiveData'
import { canDispatch, canHandover, dispatchApi } from './dispatchApi'
import { OrderDeliveryHistory } from '@/features/orders/OrderDeliveryHistory'
import { OrderDetailsFrame } from '@/features/orders/components/OrderDetailsFrame'
import { fromLiveOrder } from '@/features/orders/orderData'
import { liveOrderFocus } from '@/features/orders/orderFocus'
import { DeliverySlipDocument, InvoiceDocument } from '@/features/orders/print/OrderDocuments'
import { useCopyOrderMessage } from '@/features/orders/useCopyOrderMessage'
import { useOrderDeliveryHistory } from '@/features/orders/useOrderDeliveryHistory'
import { useSettings } from '@/features/settings/settingsService'
import { usePrinter } from '@/shared/print/usePrinter'
import { LiveOrderPayments } from './LiveOrderPayments'
import { useOrderPayments } from './paymentApi'
import { LiveOrderReturnModal } from './LiveOrderReturnModal'
import { useOrderDepositLabel } from './bottleDeposits'
import { describeActivity, useOrderActivity, useOrderReturns } from './orderReturnApi'

const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')
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
  // Nhận trả hàng làm giảm doanh thu và có thể hoàn tiền nên chỉ chủ cửa hàng (BE cũng chặn).
  const canTakeReturns = staff?.role === 'ADMIN'
  const [returning, setReturning] = useState(false)
  const returns = useOrderReturns(id)
  const activity = useOrderActivity(id, canManage)
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const payments = useOrderPayments(id)
  const orderQueryKey = ['live', 'order', staff?.name, staff?.role, id]
  const query = useQuery({
    queryKey: orderQueryKey,
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
  const handover = useMutation({
    mutationFn: () => dispatchApi.create(id),
    onSuccess: async (receipt) => {
      // Chỉ đổi trạng thái sau khi BE đã xuất kho thành công; không đánh dấu đã thanh toán.
      queryClient.setQueryData<NonNullable<typeof query.data>>(orderQueryKey, (current) =>
        current ? { ...current, status: receipt.orderStatus } : current,
      )
      message.success('Đã xuất kho và bàn giao hàng cho khách tại quầy.')
      await invalidateLiveData(queryClient)
    },
    onError: async (error: Error) => {
      message.error(error.message)
      // Bao gồm trường hợp nhân viên khác đã bàn giao đơn này (409).
      await invalidateLiveData(queryClient)
    },
  })
  const busy = update.isPending || handover.isPending
  const printer = usePrinter()
  // Tải sẵn mức cọc theo loại vỏ để phiếu giao in được ngay.
  const depositOf = useOrderDepositLabel()
  const copyMessage = useCopyOrderMessage()
  const { data: settings } = useSettings()
  const order = query.data
  // Chưa tải được danh mục thì vẫn hiện đơn với mã sản phẩm, nhưng chưa cho in để chứng từ không thiếu tên hàng.
  const viewOrder = order ? fromLiveOrder(order, catalog.data ?? [], payments.data?.balance) : undefined
  const canPrint = Boolean(catalog.data && settings && payments.data)
  const lastAttempt = trips.data?.at(-1)?.assignment.latestAttempt
  const lastTrip = trips.data?.at(-1)?.trip

  const moreItems: MenuProps['items'] =
    viewOrder && viewOrder.status !== 'Đã hủy'
      ? [
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
                  onClick: () => printer.print(<DeliverySlipDocument order={viewOrder} settings={settings} depositRate={depositOf(viewOrder)} />),
                },
              ]
            : []),
          ...(order && ['DELIVERED', 'COMPLETED'].includes(order.status)
            ? [
                {
                  key: 'return',
                  label: 'Nhận trả hàng',
                  disabled: !canTakeReturns,
                  extra: canTakeReturns ? undefined : 'Chủ cửa hàng',
                  onClick: () => setReturning(true),
                },
              ]
            : []),
        ]
      : []

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
      ) : canHandover(order) ? (
        <Popconfirm
          title={`Bàn giao đơn ${order.orderCode} tại quầy?`}
          description="Xác nhận khách đã nhận đủ hàng. Hệ thống xuất toàn bộ hàng đã giữ và ghi nhận khách đã nhận hàng; thanh toán được theo dõi riêng."
          okText="Xác nhận bàn giao"
          cancelText="Chưa"
          disabled={busy}
          okButtonProps={{ loading: handover.isPending, disabled: busy }}
          onConfirm={() => { if (!busy) handover.mutate() }}
        >
          <Button type="primary" loading={handover.isPending} disabled={busy}>
            Bàn giao tại quầy
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
        disabled={busy}
        cancelText="Không"
        onConfirm={() => { if (!busy) update.mutate('CANCELLED') }}
      >
        <Button type="text" danger loading={update.isPending && update.variables === 'CANCELLED'} disabled={busy}>
          Hủy đơn
        </Button>
      </Popconfirm>
    ) : null

  const productName = (productId: number) => catalog.data?.find((product) => product.id === productId)?.name ?? `Sản phẩm #${productId}`
  const historyEvents = order
    ? [
        { at: order.createdAt, message: 'Tạo đơn' },
        ...(order.confirmedAt ? [{ at: order.confirmedAt, message: 'Xác nhận đơn' }] : []),
        ...(order.cancelledAt ? [{ at: order.cancelledAt, message: 'Hủy đơn' }] : []),
      ]
    : []
  // Có nhật ký chi tiết thì dùng nhật ký (kèm người làm); chưa có (đơn cũ, lỗi tải) thì dùng các mốc chính của đơn.
  const timeline: { key: string; at: string; message: string; actor?: string }[] = activity.data?.length
    ? activity.data.map((entry, index) => ({
        key: `${entry.kind}-${entry.entityId ?? index}-${entry.at}`,
        at: entry.at,
        message: describeActivity(entry),
        actor: entry.actorName,
      }))
    : historyEvents.map((event) => ({ ...event, key: event.message }))
  const returnedTotal = (returns.data?.returns ?? []).reduce((sum, entry) => sum + Number(entry.value), 0)
  const moreSections: CollapseProps['items'] = order
    ? [
        { key: 'payments', label: 'Thanh toán', extra: payments.data ? `Còn phải thu ${currency(payments.data.balance.due)}` : undefined, children: <LiveOrderPayments orderId={id} /> },
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
          key: 'returns',
          label: 'Hàng trả lại',
          extra: returns.data ? (returns.data.returns.length ? `${returns.data.returns.length} lần · ${currency(returnedTotal)}` : 'Chưa có') : undefined,
          children: returns.isError ? (
            <QueryError error={returns.error} onRetry={returns.refetch} />
          ) : returns.isPending ? (
            <Skeleton active />
          ) : !returns.data.returns.length ? (
            <p className="af-order-more-empty">Khách chưa trả lại hàng của đơn này.</p>
          ) : (
            returns.data.returns.map((entry) => (
              <div key={entry.id} className="af-order-receipt">
                <p>
                  <strong>{dateTime(entry.createdAt)}</strong> · {entry.performedByName} · {entry.reason}
                  <br />
                  <Typography.Text type="secondary">
                    {entry.restocked ? 'Đã nhập lại tồn bán được' : 'Hàng hỏng, loại khỏi kho'}
                    {Number(entry.refunded) > 0 ? ` · Đã hoàn ${currency(entry.refunded)}` : ''}
                  </Typography.Text>
                </p>
                <Table
                  rowKey="orderItemId"
                  size="small"
                  dataSource={entry.lines}
                  pagination={false}
                  scroll={{ x: 450 }}
                  columns={[
                    { title: 'Sản phẩm', dataIndex: 'productName' },
                    { title: 'Số lượng', dataIndex: 'quantity', align: 'right' },
                    { title: 'Giá trị', dataIndex: 'value', align: 'right', render: currency },
                  ]}
                />
              </div>
            ))
          ),
        },
        {
          key: 'history',
          label: 'Lịch sử xử lý',
          extra: `${activity.data?.length || historyEvents.length} mốc`,
          children: (
            <>
              <Timeline
                items={[...timeline].reverse().map((event) => ({
                  key: event.key,
                  content: (
                    <>
                      <div>{event.message}</div>
                      <Typography.Text type="secondary">
                        {dateTime(event.at)}
                        {event.actor ? ` · ${event.actor}` : ''}
                      </Typography.Text>
                    </>
                  ),
                }))}
              />
              {activity.isError ? (
                <p className="af-form-hint">Không tải được nhật ký chi tiết; đang hiện các mốc chính của đơn.</p>
              ) : (
                <p className="af-form-hint">Thao tác trước khi bật nhật ký chỉ có các mốc chính.</p>
              )}
            </>
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

  const balance = payments.data?.balance
  return (
    <OrderDetailsFrame
      order={order ? viewOrder : undefined}
      placeholder={query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Skeleton active />}
      focus={
        order
          ? liveOrderFocus(
              order,
              lastAttempt?.outcome === 'FAILED' ? (lastAttempt.failureReason ?? null) : undefined,
              order.fulfillmentType === 'DELIVERY' && trips.isSuccess && !trips.data.length,
            )
          : undefined
      }
      progress={order}
      notice={
        catalog.isError && (
          <Alert
            type="warning"
            title="Không tải được tên sản phẩm; đang hiển thị mã định danh."
            action={<Button onClick={() => void catalog.refetch()}>Thử lại</Button>}
            style={{ marginBottom: 16 }}
          />
        )
      }
      sections={moreSections}
      cancelAction={cancelAction}
      moreItems={moreItems}
      actions={primaryAction}
      onClose={onClose}
      totals={
        order && (
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
                <>
                  {returnedTotal > 0 && (
                    <div className="is-after-total">
                      <dt>Hàng trả lại</dt>
                      <dd>−{currency(returnedTotal)}</dd>
                    </div>
                  )}
                  {balance && (
                    <>
                      <div className={returnedTotal > 0 ? undefined : 'is-after-total'}>
                        <dt>Đã thu</dt>
                        <dd>
                          <Money value={Number(balance.paid)} tone={Number(balance.paid) > 0 ? 'paid' : 'neutral'} />
                        </dd>
                      </div>
                      <div>
                        <dt>Còn phải thu</dt>
                        <dd>
                          <strong>
                            <Money value={Number(balance.due)} tone={dueTone(Number(balance.due))} />
                          </strong>
                        </dd>
                      </div>
                    </>
                  )}
                  <div className="is-status">
                    <Tag color={paymentTagColors[order.paymentStatus]}>{paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}</Tag>
                  </div>
                </>
              )
            }
          />
        )
      }
    >
      {printer.portal}
      {returning && order && (
        <LiveOrderReturnModal
          order={{ id: order.id, orderCode: order.orderCode, subtotal: Number(order.subtotal), discountAmount: Number(order.discountAmount) }}
          balance={balance}
          onClose={() => setReturning(false)}
        />
      )}
    </OrderDetailsFrame>
  )
}
