import { createContext } from 'react'
import type { LoginCredentials } from './authService'

export type AuthUser = { name: string; role: string; email?: string; isDemo?: boolean }

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  enterDemo: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
