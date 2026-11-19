// Đã trả lời câu hỏi khu vực trong lần tải trang này: chuyển trang trong web không hỏi lại; mở mới hoặc tải lại trang thì hỏi lại.
let answered = false

export const deliveryAreaVisit = {
  answered: () => answered,
  markAnswered: () => {
    answered = true
  },
  /** Cho test bắt đầu như một lần vào web mới. */
  reset: () => {
    answered = false
  },
}
