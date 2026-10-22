import { TransferQr } from '../../../shared/payment/TransferQr'
import { bankBinOf, transferNote } from '../../../shared/payment/vietqr'
import { PrintHeader } from '../../../shared/print/PrintHeader'
import { DEPOSIT_PER_BOTTLE } from '../../../shared/policy'
import { currency, printDate } from '../../../shared/utils/format'
import type { StoreSettings } from '../../settings/types'
import { amountDue, jugCount, paidAmount, returnedValue, type Order } from '../types'

type DocumentProps = { order: Order; settings?: StoreSettings }

/** Hóa đơn bán lẻ cho khách: dòng hàng, tiền đã thu, còn phải thu. Không thay thế hóa đơn điện tử GTGT. */
export function InvoiceDocument({ order, settings }: DocumentProps) {
  const due = amountDue(order)
  return (
    <article className="af-doc">
      <PrintHeader settings={settings} title="HÓA ĐƠN BÁN LẺ" code={order.id} date={printDate()} />
      <section className="af-doc-meta">
        <span>
          Khách hàng: <strong>{order.customer}</strong>
        </span>
        {order.phone && <span>Điện thoại: {order.phone}</span>}
        <span>
          Nhận hàng: {order.method}
          {order.method === 'Giao tận nơi' ? ` · ${order.address}` : ''}
        </span>
      </section>
      <table className="af-doc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Sản phẩm</th>
            <th className="af-doc-num">SL</th>
            <th className="af-doc-num">Đơn giá</th>
            <th className="af-doc-num">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, index) => (
            <tr key={line.productId}>
              <td>{index + 1}</td>
              <td>
                {line.name}
                <small> ({line.unit.toLowerCase()})</small>
              </td>
              <td className="af-doc-num">{line.quantity}</td>
              <td className="af-doc-num">{currency(line.unitPrice)}</td>
              <td className="af-doc-num">{currency(line.quantity * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {order.deliveryFee > 0 && (
            <tr>
              <td colSpan={4}>Phí giao hàng</td>
              <td>{currency(order.deliveryFee)}</td>
            </tr>
          )}
          {order.returns?.length ? (
            <tr>
              <td colSpan={4}>Hàng khách trả lại</td>
              <td>−{currency(returnedValue(order))}</td>
            </tr>
          ) : null}
          <tr className="af-doc-total">
            <td colSpan={4}>Tổng cộng</td>
            <td>{currency(order.total)}</td>
          </tr>
          <tr>
            <td colSpan={4}>Đã thanh toán</td>
            <td>{currency(paidAmount(order))}</td>
          </tr>
          <tr className="af-doc-total">
            <td colSpan={4}>Còn phải thu</td>
            <td>{order.status === 'Đã hủy' ? '—' : currency(due)}</td>
          </tr>
        </tfoot>
      </table>
      {order.bottles?.deposit ? (
        <p className="af-doc-note">
          Tiền cọc vỏ đã thu: {currency(order.bottles.deposit)} (khoản thế chân, hoàn lại khi trả vỏ, không tính vào tiền hàng).
        </p>
      ) : null}
      {settings?.bankAccount && due > 0 && order.status !== 'Đã hủy' &&
        (bankBinOf(settings.bankName) ? (
          <section className="af-doc-qr">
            <TransferQr settings={settings} amount={due} note={order.id} size={92} compact />
            <small>Quét mã bằng ứng dụng ngân hàng để chuyển đúng số tiền và nội dung.</small>
          </section>
        ) : (
          <p className="af-doc-note">
            Chuyển khoản: {settings.bankName} · {settings.bankAccount} · {settings.bankHolder} · Nội dung: <strong>{transferNote(order.id)}</strong>
          </p>
        ))}
      <footer className="af-doc-footer">
        <p>{settings?.invoiceNote}</p>
        <small>Chứng từ bán lẻ nội bộ, không thay thế hóa đơn điện tử giá trị gia tăng.</small>
      </footer>
    </article>
  )
}

/** Phiếu giao hàng cho tài xế: địa chỉ, hàng, tiền và vỏ cần xử lý, chỗ ký nhận. */
export function DeliverySlipDocument({ order, settings }: DocumentProps) {
  const jugs = jugCount(order)
  return (
    <article className="af-doc">
      <PrintHeader settings={settings} title="PHIẾU GIAO HÀNG" code={order.id} date={printDate()} />
      <section className="af-doc-meta af-doc-meta-grid">
        <span>
          Người nhận: <strong>{order.customer}</strong>
        </span>
        <span>Điện thoại: {order.phone || '—'}</span>
        <span className="af-doc-wide">
          Địa chỉ: <strong>{order.address}</strong>
          {order.floor ? ` · Lầu ${order.floor} (thang bộ)` : ''}
        </span>
        <span>Giờ hẹn: {order.appointment ? new Date(order.appointment).toLocaleString('vi-VN') : 'Trong ngày'}</span>
        <span>Ghi chú: {order.note || '—'}</span>
      </section>
      <table className="af-doc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Hàng giao</th>
            <th className="af-doc-num">SL</th>
            <th>Đơn vị</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, index) => (
            <tr key={line.productId}>
              <td>{index + 1}</td>
              <td>{line.name}</td>
              <td className="af-doc-num">{line.quantity}</td>
              <td>{line.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="af-doc-checklist">
        <div>
          <span>Tiền cần thu</span>
          <strong>{currency(amountDue(order))}</strong>
        </div>
        {jugs > 0 && (
          <>
            <div>
              <span>Vỏ rỗng cần đổi</span>
              <strong>{jugs} vỏ</strong>
            </div>
            <div>
              <span>Vỏ thực nhận</span>
              <strong className="af-doc-blank" />
            </div>
            <div>
              <span>Cọc thu thêm ({currency(DEPOSIT_PER_BOTTLE)}/vỏ thiếu)</span>
              <strong className="af-doc-blank" />
            </div>
          </>
        )}
      </section>
      <section className="af-doc-signatures">
        <div>
          <strong>Người giao</strong>
          <small>(Ký, ghi rõ họ tên)</small>
        </div>
        <div>
          <strong>Người nhận</strong>
          <small>(Ký, ghi rõ họ tên)</small>
        </div>
      </section>
    </article>
  )
}
