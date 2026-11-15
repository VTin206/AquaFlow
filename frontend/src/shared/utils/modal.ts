/** Ba cỡ hộp thoại dùng chung: nhỏ cho form ngắn, vừa cho danh sách gọn, lớn cho form dài và màn chi tiết. */
export const modalWidth = { small: 600, medium: 760, large: 960 } as const

/** Thân hộp thoại tự cuộn để nút và tổng tiền ở thanh dưới luôn nhìn thấy. */
export const modalScrollBody = {
  body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 },
} as const

/** Hộp thoại danh mục (loại sản phẩm, loại vỏ): vừa một hàng tìm kiếm, bộ lọc và nút thêm. */
export const modalFixedWidth = 820

/**
 * Thân hộp thoại danh mục cao cố định: đổi bộ lọc hay danh sách ít dòng thì cửa sổ không co giãn.
 * Thân không tự cuộn; bảng `af-modal-table-fixed` bên trong giãn hết phần còn lại và tự cuộn.
 */
export const modalFixedBody = {
  body: { height: 'min(440px, calc(100dvh - 200px))', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
} as const
