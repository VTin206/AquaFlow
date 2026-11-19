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
    return new ApiError(error.status, 'Không kết nối được máy chủ. Vui lòng thử lại sau.', error.body)
  return error
}

/**
 * Kết quả xin mã xác nhận email. `required: false`: cửa hàng chưa bật xác nhận email, đăng ký luôn không cần mã.
 * `resendAfterSeconds`: số giây phải đợi trước khi được gửi lại (mã vừa gửi trước đó vẫn dùng được).
 */
export type RegisterCode = { required: boolean; resendAfterSeconds: number }

const DUPLICATE_ACCOUNT =
  'Email hoặc số điện thoại đã được sử dụng. Nếu bạn đã mua hàng tại cửa hàng, hãy liên hệ cửa hàng để liên kết tài khoản.'
const SERVER_DOWN = 'Không kết nối được máy chủ. Vui lòng thử lại sau.'

export const authService = {
  requestRegisterCode: async (input: Pick<RegisterInput, 'email' | 'phone'>): Promise<RegisterCode> => {
    try {
      const sent = await api.post<{ required: boolean; resendAfterSeconds?: number }>('/auth/register/verification-codes', {
        email: input.email.trim(),
        phone: input.phone.trim(),
      })
      return { required: sent.required, resendAfterSeconds: sent.resendAfterSeconds ?? 60 }
    } catch (error) {
      if (error instanceof ApiError) {
        // Mã vừa gửi cho email này chưa quá 60 giây: dùng tiếp mã đó.
        const wait = (error.body as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds
        if (error.status === 429 && wait) return { required: true, resendAfterSeconds: wait }
        if (error.status === 409) throw new Error(DUPLICATE_ACCOUNT, { cause: error })
        if (error.status === 400) throw new Error('Email hoặc số điện thoại không hợp lệ.', { cause: error })
        // 429 (xin mã quá nhiều lần) và 503 (không gửi được mail) đã có câu tiếng Việt từ máy chủ.
        if (error.status === 429 || error.status === 503) throw error
        if (error.status === 0 || error.status >= 500) throw new Error(SERVER_DOWN, { cause: error })
      }
      throw error
    }
  },
  register: async (input: RegisterInput, verificationCode?: string) => {
    try {
      return await api.post<CurrentUser>('/auth/register', {
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        password: input.password,
        ...(verificationCode ? { verificationCode } : {}),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) throw new Error(DUPLICATE_ACCOUNT, { cause: error })
        // Form đã kiểm tra các ô giống máy chủ, nên 400 khi có mã là lỗi mã (sai, hết hạn, quá số lần): giữ câu của máy chủ.
        if (error.status === 400 && verificationCode) throw error
        if (error.status === 400)
          throw new Error(
            'Thông tin đăng ký không hợp lệ. Kiểm tra email, số điện thoại và mật khẩu (8–128 ký tự, tối đa 72 byte UTF-8).',
            { cause: error },
          )
        if (error.status === 0 || error.status >= 500) throw new Error(SERVER_DOWN, { cause: error })
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
  /** Thu hồi refresh token của phiên này trên máy chủ và xóa cookie. */
  logout: () => api.post<void>('/auth/logout', undefined, { withCredentials: true }),
}
