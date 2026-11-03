import { useState } from 'react'
import { App, Button, Dropdown } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCheck, FileSpreadsheet, Printer } from 'lucide-react'
import { BulkBar } from '@/shared/components/BulkBar'
import { useFeature, useIsDemo } from '@/shared/features'
import { usePrinter } from '@/shared/print/usePrinter'
import { runEach } from '@/shared/utils/bulk'
import { downloadExcel, type ExcelColumn } from '@/shared/utils/excel'
import { useSettings } from '@/features/settings/settingsService'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { orderApi } from '@/features/live/orderApi'
import { DeliverySlipDocument, InvoiceDocument } from '../print/OrderDocuments'
import { amountDue, orderedAtOf, type Order } from '../types'
import { useAdvanceOrderStatus } from '../useOrders'

const codeOf = (order: Order) => order.code ?? order.id

/** Thao tác cho các đơn đã tích chọn: xác nhận đơn chờ, in chứng từ (bản dùng thử), xuất Excel. */
export function OrderBulkActions({ orders, onSelect }: { orders: Order[]; onSelect: (ids: string[]) => void }) {
  const { message, modal } = App.useApp()
  const demo = useIsDemo()
  const showPayments = useFeature('orderPayments')
  const queryClient = useQueryClient()
  const advance = useAdvanceOrderStatus()
  const printer = usePrinter()
  const { data: settings } = useSettings(demo)
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận')
  const deliveries = orders.filter((order) => order.method === 'Giao tận nơi' && order.status !== 'Đã hủy')
  const printable = orders.filter((order) => order.status !== 'Đã hủy')

  const confirmPending = () =>
    modal.confirm({
      title: `Xác nhận ${pending.length} đơn chờ?`,
      content: (
        <div className="af-confirm-body">
          <p>Hàng của các đơn này sẽ được giữ trong kho, lần lượt theo thứ tự trong bảng.</p>
          {orders.length > pending.length && <p>{orders.length - pending.length} đơn đã chọn không ở trạng thái chờ nên được bỏ qua.</p>}
        </div>
      ),
      okText: 'Xác nhận',
      cancelText: 'Không',
      onOk: async () => {
        setConfirming(true)
        const result = await runEach(pending, (order) =>
          demo ? advance.mutateAsync(order.id) : orderApi.updateStatus(Number(order.id), 'CONFIRMED'),
        )
        if (!demo) void invalidateLiveData(queryClient)
        setConfirming(false)
        if (!result.failed.length) {
          message.success(`Đã xác nhận ${result.done.length} đơn.`)
          onSelect([])
          return
        }
        onSelect(result.failed.map(({ item }) => item.id))
        modal.warning({
          title: `Đã xác nhận ${result.done.length}/${pending.length} đơn`,
          content: (
            <div className="af-confirm-body">
              <p>Các đơn chưa xác nhận được vẫn được chọn để xử lý tiếp:</p>
              <ul className="af-bulk-errors">
                {result.failed.map(({ item, error }) => (
                  <li key={item.id}>
                    <strong>{codeOf(item)}</strong>: {error}
                  </li>
                ))}
              </ul>
            </div>
          ),
        })
      },
    })

  const exportExcel = async () => {
    setExporting(true)
    const columns: ExcelColumn<Order>[] = [
      { title: 'Mã đơn', width: 18, value: codeOf },
      { title: 'Đặt lúc', width: 20, value: (order) => orderedAtOf(order).full },
      { title: 'Khách hàng', width: 24, value: (order) => order.customer },
      { title: 'Số điện thoại', width: 15, value: (order) => order.phone },
      { title: 'Địa chỉ', width: 36, value: (order) => order.address },
      { title: 'Hình thức', width: 14, value: (order) => order.method },
      { title: 'Kênh', width: 12, value: (order) => order.channel },
      { title: 'Trạng thái', width: 16, value: (order) => order.status },
      { title: 'Hẹn giao', width: 20, value: (order) => (order.appointment ? new Date(order.appointment).toLocaleString('vi-VN') : '') },
      { title: 'Sản phẩm', width: 40, value: (order) => order.items },
      { title: 'Tổng tiền', width: 16, format: 'money', value: (order) => order.total },
      ...(showPayments ? [{ title: 'Còn phải thu', width: 16, format: 'money', value: amountDue } satisfies ExcelColumn<Order>] : []),
    ]
    try {
      await downloadExcel(`don-hang-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Đơn hàng', columns, orders)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không xuất được tệp Excel.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <BulkBar count={orders.length} noun="đơn" onClear={() => onSelect([])}>
        <Button type="primary" icon={<CheckCheck size={16} />} disabled={!pending.length} loading={confirming} onClick={confirmPending}>
          Xác nhận{pending.length ? ` (${pending.length})` : ''}
        </Button>
        {demo && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'invoice',
                  label: `Hóa đơn (${printable.length})`,
                  disabled: !printable.length,
                  onClick: () =>
                    printer.print(
                      <>
                        {printable.map((order) => (
                          <InvoiceDocument key={order.id} order={order} settings={settings} />
                        ))}
                      </>,
                    ),
                },
                {
                  key: 'slip',
                  label: `Phiếu giao (${deliveries.length})`,
                  disabled: !deliveries.length,
                  onClick: () =>
                    printer.print(
                      <>
                        {deliveries.map((order) => (
                          <DeliverySlipDocument key={order.id} order={order} settings={settings} />
                        ))}
                      </>,
                    ),
                },
              ],
            }}
          >
            <Button icon={<Printer size={16} />}>In</Button>
          </Dropdown>
        )}
        <Button icon={<FileSpreadsheet size={16} />} loading={exporting} onClick={() => void exportExcel()}>
          Xuất Excel
        </Button>
      </BulkBar>
      {printer.portal}
    </>
  )
}
