import { ApiError } from '@/shared/api/client'

// Giả lập độ trễ mạng để trạng thái Loading hiển thị như khi gọi API thật.
const MOCK_DELAY_MS = 350

/** Chạy `handler` sau một khoảng trễ và trả về bản sao dữ liệu (giống dữ liệu nhận từ server). */
export function mockRequest<T>(handler: () => T, delay = MOCK_DELAY_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(structuredClone(handler()))
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

/** Lỗi có cùng định dạng với ApiError của backend. */
export const mockError = (status: number, message: string) => new ApiError(status, message, { status, error: 'Mock', message })
