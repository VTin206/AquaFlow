import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { App } from 'antd'
import { authService, type LoginCredentials } from './authService'
import { getStoredAuthToken, setUnauthorizedHandler, storeAuthToken } from '@/shared/api/client'
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext'
import { roleLabel, STAFF_ROLES } from './roles'
const USER_KEY = 'aquaflow.auth.user'
const EXPIRES_KEY = 'aquaflow.auth.expires-at'
const DEMO_GUEST_KEY = 'aquaflow.auth.demo-guest'
const EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'

const readExpiry = () => {
  try {
    return Number(localStorage.getItem(EXPIRES_KEY)) || null
  } catch {
    return null
  }
}

const writeExpiry = (expiresAt: number | null) => {
  try {
    if (expiresAt) localStorage.setItem(EXPIRES_KEY, String(expiresAt))
    else localStorage.removeItem(EXPIRES_KEY)
  } catch {
    // Bỏ qua khi trình duyệt chặn bộ nhớ.
  }
}

/** Token đã hết hạn từ lần mở trước thì bỏ luôn, không chờ backend trả 401. */
const readStoredToken = () => {
  const expiresAt = readExpiry()
  if (expiresAt && expiresAt <= Date.now()) {
    storeAuthToken(null)
    writeExpiry(null)
    return null
  }
  return getStoredAuthToken()
}

const readStoredUser = (): AuthUser | null => {
  try {
    const user = localStorage.getItem(USER_KEY)
    return user ? (JSON.parse(user) as AuthUser) : null
  } catch {
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      // Bỏ qua.
    }
    return null
  }
}

const saveUser = (user: AuthUser | null) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Bỏ qua.
  }
}

// Chế độ "khách dùng thử" chỉ có khi dev, bản build bỏ qua cờ này.
const readDemoGuest = () => {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem(DEMO_GUEST_KEY) === '1'
  } catch {
    return false
  }
}

const writeDemoGuest = (on: boolean) => {
  try {
    if (on) localStorage.setItem(DEMO_GUEST_KEY, '1')
    else localStorage.removeItem(DEMO_GUEST_KEY)
  } catch {
    // Bỏ qua.
  }
}

const toAuthUser = (user: { fullName: string; email: string; role: string }): AuthUser => ({ name: user.fullName || user.email, email: user.email, role: roleLabel(user.role) })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { message } = App.useApp()
  const [token, setToken] = useState(readStoredToken)
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)
  const [expiresAt, setExpiresAt] = useState(readExpiry)
  const [demoGuest, setDemoGuest] = useState(readDemoGuest)

  const clearSession = useCallback(() => {
    storeAuthToken(null)
    writeExpiry(null)
    saveUser(null)
    writeDemoGuest(false)
    setToken(null)
    setExpiresAt(null)
    setUser(null)
    setDemoGuest(false)
  }, [])

  // Hết phiên thì xóa dữ liệu đăng nhập; RequireAuth tự đưa về trang đăng nhập.
  const expire = useCallback(() => {
    clearSession()
    message.warning(EXPIRED_MESSAGE)
  }, [clearSession, message])

  // Backend từ chối token (401).
  useEffect(() => {
    setUnauthorizedHandler(expire)
    return () => setUnauthorizedHandler(null)
  }, [expire])

  // Token hết hạn trong lúc đang mở trang.
  useEffect(() => {
    if (!token || !expiresAt) return
    const timer = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [token, expiresAt, expire])

  // Mở lại app với token cũ: lấy thông tin người dùng mới nhất (401 đã được xử lý ở trên).
  useEffect(() => {
    if (!token) return
    authService
      .me()
      .then((current) => {
        const next = toAuthUser(current)
        saveUser(next)
        setUser(next)
      })
      .catch(() => {
        // Lỗi mạng: giữ phiên để dùng tiếp khi máy chủ hoạt động lại.
      })
    // Chỉ kiểm tra khi token thay đổi.
  }, [token])

  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials)
    if (!STAFF_ROLES.includes(response.user.role)) {
      throw new Error(`Tài khoản ${roleLabel(response.user.role).toLowerCase()} không dùng được trang quản lý cửa hàng.`)
    }
    const nextUser = toAuthUser(response.user)
    const nextExpiry = Date.now() + response.expiresIn * 1000
    storeAuthToken(response.accessToken)
    writeExpiry(nextExpiry)
    saveUser(nextUser)
    writeDemoGuest(false)
    setDemoGuest(false)
    setToken(response.accessToken)
    setExpiresAt(nextExpiry)
    setUser(nextUser)
  }

  const enterDemo = () => {
    storeAuthToken(null)
    writeExpiry(null)
    const demoUser = { name: 'Nguyễn An', role: 'Bản dùng thử', isDemo: true }
    saveUser(demoUser)
    writeDemoGuest(false)
    setDemoGuest(false)
    setToken(null)
    setExpiresAt(null)
    setUser(demoUser)
  }

  const enterDemoGuest = useCallback(() => {
    clearSession()
    writeDemoGuest(true)
    setDemoGuest(true)
  }, [clearSession])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user && (token || user.isDemo)),
    login,
    enterDemo,
    demoGuest,
    enterDemoGuest,
    logout: clearSession,
  }), [token, user, demoGuest, clearSession, enterDemoGuest])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
