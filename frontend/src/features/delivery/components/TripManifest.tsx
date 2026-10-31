import { PrintHeader } from '@/shared/print/PrintHeader'
import { currency, printDate } from '@/shared/utils/format'
import { amountDue, jugCount, type Order } from '@/features/orders/types'
import type { StoreSettings } from '@/features/settings/types'
import type { Trip } from '../types'

/** Phiếu chuyến cho tài xế mang theo: danh sách điểm giao, tiền và vỏ cần xử lý, cột ký nhận. */
export function TripManifest({ trip, stops, settings }: { trip: Trip; stops: Order[]; settings?: StoreSettings }) {
  const totalDue = stops.reduce((sum, order) => sum + amountDue(order), 0)
  const totalJugs = stops.reduce((sum, order) => sum + jugCount(order), 0)
  return (
    <article className="af-doc af-doc-landscape">
      <PrintHeader settings={settings} title="PHIẾU CHUYẾN GIAO HÀNG" code={trip.id} date={printDate()} />
      <section className="af-doc-meta af-doc-meta-grid">
        <span>
          Tài xế: <strong>{trip.driver}</strong>
        </span>
        <span>Biển số: {trip.vehicle ?? '—'}</span>
        <span>
          Số điểm giao: <strong>{stops.length}</strong>
        </span>
        <span>
          Tổng cần thu: <strong>{currency(totalDue)}</strong> · Bình: <strong>{totalJugs}</strong>
        </span>
      </section>
      <table className="af-doc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Đơn / khách</th>
            <th>Địa chỉ</th>
            <th>Hàng</th>
            <th className="af-doc-num">Cần thu</th>
            <th className="af-doc-num">Vỏ đổi</th>
            <th>Kết quả / ký nhận</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((order, index) => (
            <tr key={order.id}>
              <td>{index + 1}</td>
              <td>
                <strong>{order.id}</strong>
                <br />
                {order.customer}
                <br />
                {order.phone}
              </td>
              <td>
                {order.address}
                {order.floor ? ` · lầu ${order.floor}` : ''}
              </td>
              <td>{order.items}</td>
              <td className="af-doc-num">{currency(amountDue(order))}</td>
              <td className="af-doc-num">{jugCount(order) || '—'}</td>
              <td className="af-doc-sign-cell" />
            </tr>
          ))}
        </tbody>
      </table>
      <section className="af-doc-signatures">
        <div>
          <strong>Thủ kho xuất hàng</strong>
          <small>(Ký, ghi rõ họ tên)</small>
        </div>
        <div>
          <strong>Tài xế nhận hàng</strong>
          <small>(Ký, ghi rõ họ tên)</small>
        </div>
      </section>
    </article>
  )
}
