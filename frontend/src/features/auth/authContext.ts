import { createContext } from 'react'
import type { LoginCredentials } from './authService'

export type AuthUser = { name: string; role: string; email?: string; phone?: string | null }

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  /** Mở lại app khi access token đã hết hạn: đang xin token mới bằng cookie refresh, chưa biết còn phiên hay không. */
  restoring?: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  updateProfile: (profile: { fullName: string; email: string; phone: string | null }) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
