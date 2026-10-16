import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Form, Input, Result, Skeleton, Steps, Typography } from 'antd'
import { Copy, Phone, RefreshCw } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { TransferQr } from '../../shared/payment/TransferQr'
import { currency } from '../../shared/utils/format'
import type { PublicOrder } from '../orders/types'
import { useSettings } from '../settings/settingsService'
import { lookupOrder, useTrackedOrder } from './shopService'

const stepOf: Record<PublicOrder['status'], number> = {
  'Chờ xác nhận': 0,
  'Đang chuẩn bị': 1,
  'Đang giao': 2,
  'Giao thất bại': 2,
  'Đã giao': 3,
  'Đã hoàn tất': 3,
  'Đã hủy': 0,
}

/** Tra cứu bằng mã đơn và số điện thoại khi khách không còn giữ liên kết. */
function LookupForm() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  return (
    <Card className="af-shop-track-card" title="Tra cứu đơn hàng">
      <Form
        layout="vertical"
        onFinish={async ({ id, phone }: { id: string; phone: string }) => {
          setLoading(true)
          setError(undefined)
          try {
            const order = await lookupOrder(id, phone)
            navigate(`/track/${order.trackingToken}`)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không tra cứu được đơn.')
          } finally {
            setLoading(false)
          }
        }}
      >
        <Form.Item name="id" label="Mã đơn" rules={[{ required: true, whitespace: true, message: 'Nhập mã đơn, ví dụ AF-1070.' }]}>
          <Input placeholder="AF-1070" autoCapitalize="characters" />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại đặt hàng" rules={[{ required: true, message: 'Nhập số điện thoại đã dùng khi đặt.' }]}>
          <Input inputMode="tel" />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" loading={loading} block>
          Tra cứu
        </Button>
      </Form>
    </Card>
  )
}

function TrackedOrder({ token }: { token: string }) {
  const { message } = App.useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const orderQuery = useTrackedOrder(token)
  const order = orderQuery.data
  const placed = (location.state as { placed?: boolean } | null)?.placed

  useEffect(() => {
    document.title = order ? `Đơn ${order.id} | Theo dõi đơn` : 'Theo dõi đơn'
  }, [order])

  if (orderQuery.isPending) return <Skeleton active paragraph={{ rows: 8 }} />
  if (orderQuery.isError || !order)
    return (
      <Result
        status="404"
        title="Không tìm thấy đơn"
        subTitle="Liên kết không đúng hoặc đã hết hiệu lực. Tra cứu lại bằng mã đơn và số điện thoại."
        extra={
          <Button type="primary" onClick={() => navigate('/track')}>
            Tra cứu đơn
          </Button>
        }
      />
    )

  const cancelled = order.status === 'Đã hủy'
  const failed = order.status === 'Giao thất bại'
  const canTransfer = !cancelled && order.due > 0 && order.status !== 'Chờ xác nhận'

  return (
    <div className="af-shop-track">
      {placed && <Alert type="success" showIcon title={`Đã gửi đơn ${order.id}`} description="Lưu lại trang này (hoặc chụp màn hình mã đơn) để theo dõi. Cửa hàng sẽ gọi xác nhận trong giờ làm việc." />}
      <Card
        className="af-shop-track-card"
        title={`Đơn ${order.id}`}
        extra={
          <Button
            type="text"
            icon={<RefreshCw size={16} />}
            aria-label="Cập nhật trạng thái"
            loading={orderQuery.isFetching}
            onClick={() => void orderQuery.refetch()}
          />
        }
      >
        {cancelled ? (
          <Alert type="warning" showIcon title="Đơn đã hủy" description="Liên hệ cửa hàng nếu cần đặt lại hoặc hỏi về khoản đã thanh toán." />
        ) : (
          <Steps
            size="small"
            current={stepOf[order.status]}
            status={failed ? 'error' : stepOf[order.status] === 3 ? 'finish' : 'process'}
            items={[
              { title: 'Đã đặt', content: order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : undefined },
              { title: 'Đã xác nhận' },
              { title: failed ? 'Giao chưa thành công' : 'Đang giao', content: failed ? 'Cửa hàng sẽ liên hệ hẹn lại' : undefined },
              { title: 'Đã nhận hàng', content: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : undefined },
            ]}
          />
        )}
        <dl className="af-shop-track-info">
          <dt>Người nhận</dt>
          <dd>{order.customer}</dd>
          <dt>Địa chỉ</dt>
          <dd>{order.address}</dd>
          {order.appointment && (
            <>
              <dt>Giờ hẹn</dt>
              <dd>{new Date(order.appointment).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</dd>
            </>
          )}
        </dl>
        <ul className="af-shop-cart af-shop-track-lines">
          {order.lines.map((line) => (
            <li key={line.productId}>
              <div>
                <strong>{line.name}</strong>
                <small>
                  {line.quantity} × {currency(line.unitPrice)}
                </small>
              </div>
              <span>{currency(line.quantity * line.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="af-order-summary">
          <span>Phí giao</span>
          <span>{order.deliveryFee ? currency(order.deliveryFee) : 'Miễn phí'}</span>
        </div>
        <div className="af-order-summary af-order-summary-highlight">
          <span>{order.status === 'Chờ xác nhận' ? 'Tạm tính' : 'Tổng cộng'}</span>
          <strong>{currency(order.total)}</strong>
        </div>
        {order.paid > 0 && (
          <div className="af-order-summary">
            <span>Đã thanh toán</span>
            <span>{currency(order.paid)}</span>
          </div>
        )}
        {!cancelled && (
          <div className="af-order-summary">
            <span>Còn phải trả</span>
            <strong>{currency(order.due)}</strong>
          </div>
        )}
      </Card>

      {canTransfer && (
        <Card className="af-shop-track-card" title="Chuyển khoản">
          <TransferQr settings={settings} amount={order.due} note={order.id} />
          <p className="af-form-hint">Quét mã bằng ứng dụng ngân hàng, giữ nguyên nội dung để cửa hàng đối chiếu. Hoặc trả tiền mặt khi nhận hàng.</p>
        </Card>
      )}
      {order.status === 'Chờ xác nhận' && (
        <Alert type="info" showIcon title="Chờ cửa hàng xác nhận" description="Giá được chốt khi xác nhận. Sau đó trang này sẽ hiện mã QR nếu bạn muốn chuyển khoản trước." />
      )}

      <div className="af-shop-track-actions">
        <Button
          icon={<Copy size={16} />}
          onClick={() =>
            navigator.clipboard
              ?.writeText(window.location.href)
              .then(() => message.success('Đã chép liên kết theo dõi đơn.'))
              .catch(() => message.info('Hãy lưu lại địa chỉ trang này để theo dõi đơn.'))
          }
        >
          Chép liên kết
        </Button>
        {settings?.phone && (
          <Button icon={<Phone size={16} />} href={`tel:${settings.phone.replace(/\s/g, '')}`}>
            Gọi cửa hàng
          </Button>
        )}
        <Link to="/shop" className="af-text-link">
          Tiếp tục mua
        </Link>
      </div>
      <Typography.Paragraph type="secondary" className="af-shop-track-privacy">
        Liên kết này chỉ dành cho bạn. Người có liên kết xem được tên, địa chỉ và sản phẩm của đơn.
      </Typography.Paragraph>
    </div>
  )
}

export function TrackPage() {
  const { token } = useParams()
  useEffect(() => {
    if (!token) document.title = 'Tra cứu đơn hàng'
  }, [token])
  return <div className="af-shop-page af-shop-narrow">{token ? <TrackedOrder token={token} /> : <LookupForm />}</div>
}
