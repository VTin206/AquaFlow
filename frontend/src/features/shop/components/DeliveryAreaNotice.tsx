import { useState } from 'react'
import { Button, Modal } from 'antd'
import { MapPin, Phone } from 'lucide-react'
import { DELIVERY_AREA, DELIVERY_AREA_EXCLUDES } from '@/shared/address/hcmWards'
import { deliveryAreaVisit } from '../deliveryAreaVisit'

/**
 * Mỗi lần mới vào web là hỏi khu vực (như chọn miền khi vào trang LaVie), để khách biết ngay cửa hàng chỉ giao trong
 * TP.HCM cũ, không phải đợi tới bước đặt hàng.
 */
export function DeliveryAreaNotice({ phone }: { phone?: string }) {
  const [open, setOpen] = useState(() => !deliveryAreaVisit.answered())
  const [outside, setOutside] = useState(false)
  const tel = phone?.replace(/\s/g, '')
  const close = () => {
    deliveryAreaVisit.markAnswered()
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      centered
      width={420}
      title={outside ? 'Chưa giao tới khu vực của bạn' : 'Bạn đang ở TP. Hồ Chí Minh?'}
      onCancel={close}
      footer={
        outside ? (
          <Button type="primary" onClick={close}>
            Vẫn xem sản phẩm
          </Button>
        ) : (
          <>
            <Button
              onClick={() => {
                deliveryAreaVisit.markAnswered()
                setOutside(true)
              }}
            >
              Tôi ở nơi khác
            </Button>
            <Button type="primary" onClick={close}>
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
