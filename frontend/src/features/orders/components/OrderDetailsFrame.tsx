import type { ReactNode } from 'react'
import { Button, Collapse, Dropdown, Modal, type CollapseProps, type MenuProps } from 'antd'
import { Ellipsis } from 'lucide-react'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'
import type { LiveOrder } from '@/features/live/orderApi'
import { OrderProgress } from '../OrderProgress'
import type { OrderFocus } from '../orderFocus'
import type { Order } from '../types'
import { LateTag } from './LateTag'
import { OrderFocusBanner, OrderLines, OrderParty } from './OrderSheet'
import { OrderStatusTag } from './OrderStatusTag'

type Props = {
  /** Chưa có đơn (đang tải, lỗi) thì `placeholder` thay cho phần thân. */
  order?: Order
  placeholder?: ReactNode
  focus?: OrderFocus
  progress?: Pick<LiveOrder, 'status' | 'fulfillmentType'>
  notice?: ReactNode
  totals?: ReactNode
  sections?: CollapseProps['items']
  cancelAction?: ReactNode
  moreItems?: MenuProps['items']
  actions?: ReactNode
  onClose: () => void
  children?: ReactNode
}

/** Khung chi tiết đơn dùng chung: đơn đang cần gì → ai nhận, hàng gì, bao nhiêu tiền → các mục gập lại → một hành động chính. */
export function OrderDetailsFrame({ order, placeholder, focus, progress, notice, totals, sections, cancelAction, moreItems, actions, onClose, children }: Props) {
  return (
    <>
      <Modal
        open
        centered
        className="af-order-details"
        onCancel={onClose}
        width={modalWidth.medium}
        styles={modalScrollBody}
        title={
          <span className="af-order-title">
            <span>{order ? `Đơn ${order.code ?? order.id}` : 'Chi tiết đơn hàng'}</span>
            {order && <OrderStatusTag status={order.status} method={order.method} />}
            {order && <LateTag order={order} />}
          </span>
        }
        footer={
          order ? (
            <div className="af-order-footer">
              <div>{cancelAction}</div>
              <div>
                {moreItems && moreItems.length > 0 && (
                  <Dropdown trigger={['click']} menu={{ items: moreItems }}>
                    <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
                  </Dropdown>
                )}
                {actions}
              </div>
            </div>
          ) : null
        }
      >
        {order ? (
          <>
            {focus && <OrderFocusBanner focus={focus} />}
            {progress && progress.status !== 'CANCELLED' && <OrderProgress order={progress} showStatus={false} />}
            {notice}
            <div className="af-order-sheet">
              <OrderParty order={order} />
              <OrderLines lines={order.lines}>{totals}</OrderLines>
            </div>
            <Collapse ghost className="af-order-more" defaultActiveKey={['payments']} items={sections} />
          </>
        ) : (
          placeholder
        )}
      </Modal>
      {children}
    </>
  )
}
