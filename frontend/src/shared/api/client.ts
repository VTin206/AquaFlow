import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

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

// localStorage có thể bị chặn (chế độ riêng tư); lỗi đọc/ghi coi như không có token.
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writeStorage = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Bỏ qua: phiên chỉ tồn tại tới khi tải lại trang.
  }
}

/** Các API tự xác thực bằng mật khẩu hoặc cookie refresh: không gắn access token, không tự làm mới khi bị 401. */
const SESSION_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']
const isSessionCall = (url?: string) => SESSION_PATHS.some((path) => url?.startsWith(path))

httpClient.interceptors.request.use((config) => {
  const token = isSessionCall(config.url) ? null : readStorage(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  return config
})

let onUnauthorized: (() => void) | null = null

/** Gọi khi phiên đã kết thúc: không làm mới được access token (refresh token hết hạn, bị thu hồi, tài khoản bị khóa). */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler
}

/** Phản hồi /auth/refresh: cùng dạng với đăng nhập, kèm thông tin người dùng mới nhất. */
export type RefreshedSession = {
  accessToken: string
  expiresIn: number
  user?: { fullName: string; email: string; phone?: string | null; role: string }
}
let onRefreshed: ((session: RefreshedSession) => void) | null = null

/** Báo cho AuthProvider khi có access token mới để cập nhật hạn phiên. */
export const setSessionRefreshedHandler = (handler: ((session: RefreshedSession) => void) | null) => {
  onRefreshed = handler
}

/** `ended`: phải đăng nhập lại. `unavailable`: lỗi mạng/máy chủ, giữ phiên để thử lại sau. */
export type RefreshResult = { token: string } | 'ended' | 'unavailable'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Chờ tab khác đang làm mới cùng lúc ghi xong token mới trước khi kết luận phiên đã hết. */
export const REFRESH_RACE_WAIT_MS = 800

async function requestRefresh(): Promise<RefreshResult> {
  const before = readStorage(TOKEN_KEY)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Cookie refresh HttpOnly đi kèm tự động (cùng origin qua proxy /api).
      const { data } = await httpClient.post<RefreshedSession>('/auth/refresh', undefined, { withCredentials: true })
      writeStorage(TOKEN_KEY, data.accessToken)
      onRefreshed?.(data)
      return { token: data.accessToken }
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) return 'unavailable'
      // Tab khác có thể vừa đổi token trước: dùng token nó lưu, hoặc thử lại với cookie mới nó nhận.
      await wait(REFRESH_RACE_WAIT_MS)
      const latest = readStorage(TOKEN_KEY)
      if (latest && latest !== before) return { token: latest }
    }
  }
  return 'ended'
}

let refreshing: Promise<RefreshResult> | null = null

/** Xin access token mới bằng cookie refresh. Nhiều request cùng bị 401 dùng chung một lần làm mới. */
export function refreshAccessToken(): Promise<RefreshResult> {
  refreshing ??= requestRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

type RetriableConfig = InternalAxiosRequestConfig & { _afRetried?: boolean }

// Access token hết hạn (401): làm mới một lần rồi gửi lại request; không làm mới được mới coi là hết phiên.
httpClient.interceptors.response.use(undefined, async (error) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return Promise.reject(error)
  const config = error.config as RetriableConfig | undefined
  if (!config?.headers?.Authorization || config._afRetried || isSessionCall(config.url)) {
    if (config?.headers?.Authorization && config._afRetried) onUnauthorized?.()
    return Promise.reject(error)
  }
  const result = await refreshAccessToken()
  if (result === 'unavailable') return Promise.reject(error)
  if (result === 'ended') {
    onUnauthorized?.()
    return Promise.reject(error)
  }
  config._afRetried = true
  return httpClient.request(config)
})

const defaultMessage = (status: number) => {
  if (status === 400) return 'Dữ liệu gửi lên không hợp lệ.'
  if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (status === 404) return 'Không tìm thấy dữ liệu.'
  if (status === 429) return 'Bạn đã thử quá nhiều lần, vui lòng đợi ít phút rồi thử lại.'
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
  post: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) =>
    request<T>({ ...options, method: 'POST', url: path, data: body }),
  put: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'PUT', url: path, data: body }),
  patch: <T>(path: string, body?: unknown, options?: AxiosRequestConfig) =>
    request<T>({ ...options, method: 'PATCH', url: path, data: body }),
  delete: <T>(path: string, options?: AxiosRequestConfig) => request<T>({ ...options, method: 'DELETE', url: path }),
}

export const getStoredAuthToken = () => readStorage(TOKEN_KEY)
export const storeAuthToken = (token: string | null) => writeStorage(TOKEN_KEY, token)
