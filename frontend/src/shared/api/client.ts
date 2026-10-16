import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const TOKEN_KEY = 'aquaflow.auth.token'

/** Error shape shared with the Spring API and the local mock services. */
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

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  return config
})

const defaultMessage = (status: number) => {
  if (status === 400) return 'Dữ liệu gửi lên không hợp lệ.'
  if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (status === 404) return 'Không tìm thấy dữ liệu.'
  if (status >= 500) return 'Máy chủ đang gặp sự cố, vui lòng thử lại sau.'
  return `Yêu cầu thất bại (mã ${status}).`
}

const normalizeError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError(0, 'Yêu cầu đã bị hủy.')
  if (!axios.isAxiosError(error)) return new ApiError(0, 'Đã xảy ra lỗi không xác định.')

  const axiosError = error as AxiosError<ApiErrorBody | string>
  if (!axiosError.response) return new ApiError(0, 'Không thể kết nối tới máy chủ.')
  const body = typeof axiosError.response.data === 'object' ? axiosError.response.data : undefined
  return new ApiError(axiosError.response.status, body?.message || defaultMessage(axiosError.response.status), body)
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await httpClient.request<T>(config)
    return response.data
  } catch (error) {
    throw normalizeError(error)
  }
}

export const api = {
  get: <T>(path: string, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'GET', url: path }),
  post: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'POST', url: path, data: body }),
  put: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'PUT', url: path, data: body }),
  patch: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'PATCH', url: path, data: body }),
  delete: <T>(path: string, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'DELETE', url: path }),
}

export const getStoredAuthToken = () => localStorage.getItem(TOKEN_KEY)
export const storeAuthToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
