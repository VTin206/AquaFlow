import { App } from 'antd'
import type { CreateResult } from './tripBackend'

/** Báo kết quả tạo chuyến: thành công gọn một dòng, đơn nào chưa thêm được thì liệt kê kèm lý do. */
export function useTripCreatedNotice() {
  const { message, modal } = App.useApp()
  return (tripId: number, total: number, failed: CreateResult['failed']) => {
    if (!failed.length) {
      message.success(`Đã tạo chuyến #${tripId} với ${total} đơn.`)
      return
    }
    modal.warning({
      title: `Đã tạo chuyến #${tripId}, còn ${failed.length}/${total} đơn chưa thêm được`,
      content: (
        <ul className="af-bulk-errors">
          {failed.map(({ item, error }) => (
            <li key={item.id}>
              <strong>{item.code}</strong>: {error}
            </li>
          ))}
        </ul>
      ),
    })
  }
}
