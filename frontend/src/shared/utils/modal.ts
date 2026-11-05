/** Ba cỡ hộp thoại dùng chung: nhỏ cho form ngắn, vừa cho danh sách gọn, lớn cho form dài và màn chi tiết. */
export const modalWidth = { small: 600, medium: 760, large: 960 } as const

/** Thân hộp thoại tự cuộn để nút và tổng tiền ở thanh dưới luôn nhìn thấy. */
export const modalScrollBody = {
  body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 },
} as const
