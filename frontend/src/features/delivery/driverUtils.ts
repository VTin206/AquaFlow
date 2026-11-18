/** "Thứ Sáu, 06/11" cho dòng phụ dưới tiêu đề màn hình tài xế. */
export const driverToday = () => new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
