import { useMemo, useState, type ReactNode } from 'react'
import { authService, type LoginCredentials } from './authService'
import { getStoredAuthToken, storeAuthToken } from '../../shared/api/client'
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext'
const USER_KEY = 'aquaflow.auth.user'

const readStoredUser = (): AuthUser | null => {
  try {
    const user = localStorage.getItem(USER_KEY)
    return user ? (JSON.parse(user) as AuthUser) : null
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getStoredAuthToken)
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  const clearSession = () => {
    storeAuthToken(null)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials)
    const nextUser = { name: response.user.fullName || response.user.email, role: response.user.role }
    storeAuthToken(response.accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(response.accessToken)
    setUser(nextUser)
  }

  const enterDemo = () => {
    storeAuthToken(null)
    const demoUser = { name: 'Nguyễn An', role: 'Bản dùng thử', isDemo: true }
    localStorage.setItem(USER_KEY, JSON.stringify(demoUser))
    setToken(null)
    setUser(demoUser)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user && (token || user.isDemo)),
    login,
    enterDemo,
    logout: clearSession,
  }), [token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
