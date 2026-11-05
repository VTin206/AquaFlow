import { api, ApiError } from '@/shared/api/client'

export type LoginCredentials = { email: string; password: string }

export type LoginResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: {
    id: number
    fullName: string
    email: string
    phone: string | null
    role: string
    status: string
  }
}

export type CurrentUser = LoginResponse['user']

/** Backend trả thông điệp tiếng Anh; đổi sang câu dễ hiểu cho người dùng. */
const loginError = (error: unknown) => {
  if (!(error instanceof ApiError)) return error
  if (error.status === 401) return new ApiError(401, 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.', error.body)
  if (error.status === 400) return new ApiError(400, 'Email hoặc mật khẩu chưa đúng định dạng.', error.body)
  if (error.status === 0 || error.status >= 500)
    return new ApiError(error.status, 'Không kết nối được máy chủ. Bạn có thể xem bản dùng thử với dữ liệu mẫu.', error.body)
  return error
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    try {
      return await api.post<LoginResponse>('/auth/login', { ...credentials, email: credentials.email.trim() })
    } catch (error) {
      throw loginError(error)
    }
  },
  me: () => api.get<CurrentUser>('/auth/me'),
}
