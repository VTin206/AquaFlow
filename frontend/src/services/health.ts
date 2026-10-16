import { api } from './api'

/** Khớp với HealthController.HealthResponse ở backend. */
export type HealthResponse = {
  status: string
  message: string
  version: string
  timestamp: string
}

export const getHealth = () => api.get<HealthResponse>('/health')
