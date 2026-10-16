// Client gọi API dùng chung: mọi request tới backend đi qua đây, không gọi fetch trực tiếp trong component.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Định dạng lỗi backend trả về (com.aquaflow.shared.api.ApiError). */
export type ApiErrorBody = {
  timestamp?: string
  status: number
  error: string
  message: string
  path?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly body?: ApiErrorBody

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

let authToken: string | null = null

/** Gắn JWT vào mọi request sau khi đăng nhập; truyền null khi đăng xuất. */
export const setAuthToken = (token: string | null) => {
  authToken = token
}

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & { body?: unknown }

async function request<T>(method: string, path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Không thể kết nối tới máy chủ.')
  }

  const text = await response.text()
  const data = text ? safeParse(text) : undefined

  if (!response.ok) {
    const errorBody = isApiErrorBody(data) ? data : undefined
    throw new ApiError(response.status, errorBody?.message || defaultMessage(response.status), errorBody)
  }
  return data as T
}

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' && value !== null && 'status' in value && 'message' in value

const defaultMessage = (status: number) => {
  if (status === 400) return 'Dữ liệu gửi lên không hợp lệ.'
  if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (status === 404) return 'Không tìm thấy dữ liệu.'
  if (status >= 500) return 'Máy chủ đang gặp sự cố, vui lòng thử lại sau.'
  return `Yêu cầu thất bại (mã ${status}).`
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
