export const currency = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`
