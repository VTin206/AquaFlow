/** Kết quả chạy một thao tác cho nhiều mục: mục thành công và mục lỗi kèm lý do. */
export type BulkResult<T> = { done: T[]; failed: { item: T; error: string }[] }

/**
 * Chạy lần lượt từng mục (BE chưa có API hàng loạt); một mục lỗi không dừng các mục còn lại.
 * Chạy tuần tự để giữ đúng thứ tự giữ hàng khi nhiều đơn cùng tranh một sản phẩm.
 */
export async function runEach<T>(items: T[], run: (item: T) => Promise<unknown>): Promise<BulkResult<T>> {
  const result: BulkResult<T> = { done: [], failed: [] }
  for (const item of items) {
    try {
      await run(item)
      result.done.push(item)
    } catch (error) {
      result.failed.push({ item, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return result
}
