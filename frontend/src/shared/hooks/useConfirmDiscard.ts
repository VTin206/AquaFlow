import { App, type FormInstance } from 'antd'

/**
 * Đóng form an toàn: nếu người dùng đã nhập gì thì hỏi lại trước khi bỏ.
 * Dùng cho onCancel của Modal (nút Hủy, dấu ×, phím Esc, bấm ra ngoài).
 */
export function useConfirmDiscard(form: FormInstance, onClose: () => void) {
  const { modal } = App.useApp()
  return () => {
    if (!form.isFieldsTouched()) {
      onClose()
      return
    }
    modal.confirm({
      title: 'Bỏ thông tin đang nhập?',
      content: 'Những gì bạn vừa nhập sẽ không được lưu.',
      okText: 'Bỏ thông tin',
      okButtonProps: { danger: true },
      cancelText: 'Tiếp tục nhập',
      onOk: onClose,
    })
  }
}
