import { api, ApiError } from '@/shared/api/client'

export type LoginCredentials = { email: string; password: string }
export type RegisterInput = LoginCredentials & { fullName: string; phone: string }

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
  register: async (input: RegisterInput) => {
    try {
      return await api.post<CurrentUser>('/auth/register', {
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        password: input.password,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409)
          throw new Error(
            'Email hoặc số điện thoại đã được sử dụng. Nếu bạn đã mua hàng tại cửa hàng, hãy liên hệ cửa hàng để liên kết tài khoản.',
            { cause: error },
          )
        if (error.status === 400)
          throw new Error(
            'Thông tin đăng ký không hợp lệ. Kiểm tra email, số điện thoại và mật khẩu (8–128 ký tự, tối đa 72 byte UTF-8).',
            { cause: error },
          )
        if (error.status === 0 || error.status >= 500)
          throw new Error('Không kết nối được máy chủ. Vui lòng thử lại sau.', { cause: error })
      }
      throw error
    }
  },
  login: async (credentials: LoginCredentials) => {
    try {
      return await api.post<LoginResponse>('/auth/login', { ...credentials, email: credentials.email.trim() })
    } catch (error) {
      throw loginError(error)
    }
  },
  me: () => api.get<CurrentUser>('/auth/me'),
}
