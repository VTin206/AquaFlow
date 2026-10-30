export type SubmitLock = { current: boolean }

/** Runs one checkout request at a time and always releases the synchronous lock. */
export async function submitCheckoutOnce<T>(
  lock: SubmitLock,
  createOrder: () => Promise<T>,
  onSuccess: (order: T) => void,
  onError: (error: Error) => void,
): Promise<boolean> {
  if (lock.current) return false

  lock.current = true
  try {
    let order: T
    try {
      order = await createOrder()
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Không thể tạo đơn.'))
      return true
    }

    onSuccess(order)
    return true
  } finally {
    lock.current = false
  }
}
