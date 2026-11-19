import { useState } from 'react'
import { Button, Modal } from 'antd'
import { MapPin, Phone } from 'lucide-react'
import { DELIVERY_AREA, DELIVERY_AREA_EXCLUDES } from '@/shared/address/hcmWards'

const ANSWERED_KEY = 'aquaflow.shop.delivery-area-answered'

function answered() {
  try {
    return localStorage.getItem(ANSWERED_KEY) !== null
  } catch {
    return false
  }
}
function remember(answer: 'in' | 'out' | 'dismissed') {
  try {
    localStorage.setItem(ANSWERED_KEY, answer)
  } catch {
    // Trình duyệt chặn lưu thì lần sau hỏi lại, không ảnh hưởng việc xem hàng.
  }
}

/**
 * Hỏi khu vực ngay lần đầu khách vào cửa hàng để biết trước chỉ giao trong TP.HCM cũ, không phải đợi tới bước đặt hàng.
 * Trả lời (hoặc đóng) một lần thì trình duyệt ghi nhớ, không hỏi lại.
 */
export function DeliveryAreaNotice({ phone }: { phone?: string }) {
  const [open, setOpen] = useState(() => !answered())
  const [outside, setOutside] = useState(false)
  const tel = phone?.replace(/\s/g, '')
  const close = (answer: 'in' | 'out' | 'dismissed') => {
    remember(answer)
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      centered
      width={420}
      title={outside ? 'Chưa giao tới khu vực của bạn' : 'Bạn đang ở TP. Hồ Chí Minh?'}
      onCancel={() => close(outside ? 'out' : 'dismissed')}
      footer={
        outside ? (
          <Button type="primary" onClick={() => close('out')}>
            Vẫn xem sản phẩm
          </Button>
        ) : (
          <>
            <Button
              onClick={() => {
                remember('out')
                setOutside(true)
              }}
            >
              Tôi ở nơi khác
            </Button>
            <Button type="primary" onClick={() => close('in')}>
              Có, tôi ở TP.HCM
            </Button>
          </>
        )
      }
    >
      <p className="af-shop-area-notice">
        <MapPin size={18} aria-hidden />
        <span>
          {outside ? 'Rất tiếc, cửa hàng ' : 'Cửa hàng '}chỉ giao trong {DELIVERY_AREA}, chưa gồm {DELIVERY_AREA_EXCLUDES}.
        </span>
      </p>
      {outside && tel && (
        <p className="af-shop-area-notice">
          <Phone size={18} aria-hidden />
          <span>
            Cần hỏi thêm, gọi <a href={`tel:${tel}`}>{phone}</a>.
          </span>
        </p>
      )}
    </Modal>
  )
}
