import type { ReactNode } from 'react'
import { App } from 'antd'

export type ConfirmOptions = {
  title: ReactNode
  /** Tóm tắt điều sắp ghi để người dùng có lý do đọc trước khi bấm. */
  content?: ReactNode
  okText?: string
  cancelText?: string
  /** Nút đồng ý màu đỏ cho thao tác khó hoàn tác (khóa tài khoản, hoàn tiền…). */
  danger?: boolean
}

/**
 * Hỏi xác nhận trước thao tác khó hoàn tác hoặc liên quan tiền, tồn kho.
 * Trả về true khi người dùng đồng ý; đóng hộp thoại hay bấm "Xem lại" trả về false.
 * Đóng form đang nhập dở dùng `useConfirmDiscard`.
 */
export function useConfirm() {
  const { modal } = App.useApp()
  return ({ title, content, okText = 'Xác nhận', cancelText = 'Xem lại', danger }: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      modal.confirm({
        title,
        content: content ? <div className="af-confirm-body">{content}</div> : undefined,
        okText,
        cancelText,
        okButtonProps: danger ? { danger: true } : undefined,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
}
