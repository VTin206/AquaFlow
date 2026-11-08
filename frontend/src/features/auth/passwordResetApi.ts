import { api } from '@/shared/api/client'

export const passwordResetApi = {
  request: (email: string) => api.post<{ message: string }>('/auth/password-reset-requests', { email: email.trim() }),
  reset: (token: string, password: string) => api.post<void>('/auth/password-resets', { token, password }),
}
