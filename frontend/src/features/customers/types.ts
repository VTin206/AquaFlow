export type Customer = {
  name: string
  phone: string
  area: string
  orders: number
  /** Số vỏ bình khách đang giữ (cần thu hồi hoặc đối soát). */
  bottlesHeld: number
  initials: string
}
