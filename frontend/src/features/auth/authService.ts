import { api } from '../../shared/api/client'

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

export const authService = {
  login: (credentials: LoginCredentials) => api.post<LoginResponse>('/auth/login', credentials),
}
