import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { App } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { authService, type LoginCredentials } from './authService'
import {
  getStoredAuthToken,
  refreshAccessToken,
  setSessionRefreshedHandler,
  setUnauthorizedHandler,
  storeAuthToken,
} from '@/shared/api/client'
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext'
import { roleLabel, STAFF_ROLES } from './roles'
import { clearShopData, forgetSavedProfile } from '@/features/shop/cartStore'
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

/**
 * Access token đã hết hạn từ lần mở trước thì bỏ ngay thông tin người dùng trên máy (máy dùng chung không lộ thông tin
 * người trước). Nếu cookie refresh còn hiệu lực, AuthProvider khôi phục phiên và người dùng từ phản hồi /auth/refresh.
 */
const readStoredSession = () => {
  const expiresAt = readExpiry()
  const token = getStoredAuthToken()
  if (expiresAt && expiresAt <= Date.now()) {
    storeAuthToken(null)
    writeExpiry(null)
    saveUser(null)
    forgetSavedProfile()
    return { token: null, restoring: true }
  }
  return { token, restoring: false }
}

/** Làm mới trước khi access token hết hạn chừng này, để request đang gửi không bị 401. */
const REFRESH_AHEAD_MS = 60_000

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

const toAuthUser = (user: { fullName: string; email: string; phone?: string | null; role: string }): AuthUser => ({
  name: user.fullName || user.email,
  email: user.email,
  phone: user.phone,
  role: roleLabel(user.role),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const [initial] = useState(readStoredSession)
  const [token, setToken] = useState(initial.token)
  const [restoring, setRestoring] = useState(initial.restoring)
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)
  const [expiresAt, setExpiresAt] = useState(readExpiry)
  const [demoGuest, setDemoGuest] = useState(readDemoGuest)
  // Token có được do làm mới (không phải đăng nhập/mở lại app): không cần hỏi lại /auth/me.
  const refreshedToken = useRef<string | null>(null)

  const clearSession = useCallback(() => {
    queryClient.clear()
    storeAuthToken(null)
    writeExpiry(null)
    saveUser(null)
    writeDemoGuest(false)
    setToken(null)
    setExpiresAt(null)
    setUser(null)
    setDemoGuest(false)
  }, [queryClient])

  // Hết phiên thì xóa dữ liệu đăng nhập; RequireAuth tự đưa về trang đăng nhập.
  const expire = useCallback(() => {
    clearSession()
    forgetSavedProfile()
    message.warning(EXPIRED_MESSAGE)
  }, [clearSession, message])

  const logout = useCallback(() => {
    // Thu hồi refresh token trên máy chủ (cookie HttpOnly nên trình duyệt không tự xóa được); lỗi mạng thì vẫn đăng xuất tại máy.
    if (token) void authService.logout().catch(() => undefined)
    clearSession()
    clearShopData()
  }, [clearSession, token])

  // Không làm mới được access token nữa (refresh token hết hạn, bị thu hồi, tài khoản bị khóa).
  useEffect(() => {
    setUnauthorizedHandler(expire)
    return () => setUnauthorizedHandler(null)
  }, [expire])

  // Có access token mới (làm mới trước hạn, sau 401, hoặc tab khác đổi): cập nhật phiên; phản hồi kèm người dùng mới nhất.
  useEffect(() => {
    setSessionRefreshedHandler((session) => {
      const nextExpiry = Date.now() + session.expiresIn * 1000
      refreshedToken.current = session.accessToken
      writeExpiry(nextExpiry)
      setToken(session.accessToken)
      setExpiresAt(nextExpiry)
      if (session.user) {
        const next = toAuthUser(session.user)
        saveUser(next)
        setUser(next)
      }
    })
    return () => setSessionRefreshedHandler(null)
  }, [])

  // Mở lại app khi access token đã hết hạn: thử khôi phục phiên bằng cookie refresh.
  useEffect(() => {
    if (!initial.restoring) return
    void refreshAccessToken().then((result) => {
      if (typeof result === 'object') queryClient.clear()
      setRestoring(false)
    })
  }, [initial.restoring, queryClient])

  // Làm mới trước khi access token hết hạn; không làm mới được thì kết thúc phiên.
  useEffect(() => {
    if (!token || !expiresAt) return
    const timer = window.setTimeout(
      () => {
        void refreshAccessToken().then((result) => {
          if (result === 'ended') expire()
        })
      },
      Math.max(0, expiresAt - Date.now() - REFRESH_AHEAD_MS),
    )
    return () => window.clearTimeout(timer)
  }, [token, expiresAt, expire])

  // Đăng nhập hoặc mở lại app với token cũ: lấy thông tin người dùng mới nhất (401 đã được xử lý ở trên).
  useEffect(() => {
    if (!token || token === refreshedToken.current) return
    let active = true
    authService
      .me()
      .then((current) => {
        if (!active) return
        const next = toAuthUser(current)
        saveUser(next)
        setUser(next)
      })
      .catch(() => {
        // Lỗi mạng: giữ phiên để dùng tiếp khi máy chủ hoạt động lại.
      })
    return () => {
      active = false
    }
    // Chỉ kiểm tra khi token thay đổi.
  }, [token])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await authService.login(credentials)
      if (![...STAFF_ROLES, 'CUSTOMER'].includes(response.user.role)) {
        throw new Error(`Tài khoản ${roleLabel(response.user.role).toLowerCase()} không dùng được trang quản lý cửa hàng.`)
      }
      const nextUser = toAuthUser(response.user)
      queryClient.clear()
      const nextExpiry = Date.now() + response.expiresIn * 1000
      storeAuthToken(response.accessToken)
      writeExpiry(nextExpiry)
      saveUser(nextUser)
      writeDemoGuest(false)
      setDemoGuest(false)
      setToken(response.accessToken)
      setExpiresAt(nextExpiry)
      setUser(nextUser)
    },
    [queryClient],
  )

  const enterDemo = useCallback(() => {
    queryClient.clear()
    storeAuthToken(null)
    writeExpiry(null)
    const demoUser = { name: 'Nguyễn An', role: 'Bản dùng thử', isDemo: true }
    saveUser(demoUser)
    writeDemoGuest(false)
    setDemoGuest(false)
    setToken(null)
    setExpiresAt(null)
    setUser(demoUser)
  }, [queryClient])

  const enterDemoGuest = useCallback(() => {
    clearSession()
    writeDemoGuest(true)
    setDemoGuest(true)
  }, [clearSession])

  const updateProfile = useCallback((profile: { fullName: string; email: string; phone: string | null }) => {
    setUser(current => {
      if (!current || current.email !== profile.email) return current
      const next = { ...current, name: profile.fullName, phone: profile.phone }
      saveUser(next)
      return next
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user && (token || user.isDemo)),
      restoring,
      login,
      enterDemo,
      demoGuest,
      enterDemoGuest,
      logout,
      updateProfile,
    }),
    [token, user, restoring, demoGuest, logout, enterDemoGuest, login, enterDemo, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
