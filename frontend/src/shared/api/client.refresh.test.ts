// @vitest-environment jsdom
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, httpClient, setSessionRefreshedHandler, setUnauthorizedHandler, storeAuthToken } from './client'

type Reply = { status: number; data?: unknown }
type Route = (config: InternalAxiosRequestConfig) => Reply

const calls: { url?: string; auth?: string }[] = []
let route: Route

/** Máy chủ giả: ghi lại request (kèm access token gửi đi) và trả lời theo `route`. */
const adapter: AxiosAdapter = async (config) => {
  calls.push({ url: config.url, auth: config.headers?.Authorization as string | undefined })
  const reply = route(config)
  const response = { data: reply.data, status: reply.status, statusText: '', headers: {}, config }
  if (reply.status >= 400) throw new AxiosError('failed', String(reply.status), config, undefined, response)
  return response
}

const session = (accessToken: string) => ({ accessToken, tokenType: 'Bearer', expiresIn: 900, user: { fullName: 'Trang', email: 'a@b.c', role: 'SALES_STAFF' } })

beforeEach(() => {
  vi.useFakeTimers()
  httpClient.defaults.adapter = adapter
  calls.length = 0
  storeAuthToken('expired')
})
afterEach(() => {
  vi.useRealTimers()
  setUnauthorizedHandler(null)
  setSessionRefreshedHandler(null)
  storeAuthToken(null)
})

describe('access token refresh', () => {
  it('refreshes once for concurrent 401s, then retries each request with the new token', async () => {
    const refreshed = vi.fn()
    setSessionRefreshedHandler(refreshed)
    route = (config) =>
      config.url === '/auth/refresh'
        ? { status: 200, data: session('fresh') }
        : config.headers?.Authorization === 'Bearer fresh'
          ? { status: 200, data: { url: config.url } }
          : { status: 401 }

    const results = await Promise.all([api.get('/sales/orders'), api.get('/sales/customers')])

    expect(results).toEqual([{ url: '/sales/orders' }, { url: '/sales/customers' }])
    expect(calls.filter((call) => call.url === '/auth/refresh')).toHaveLength(1)
    // Cookie refresh tự xác thực: không gửi access token cũ kèm yêu cầu làm mới.
    expect(calls.find((call) => call.url === '/auth/refresh')?.auth).toBeUndefined()
    expect(refreshed).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'fresh', expiresIn: 900 }))
  })

  it('ends the session only when the refresh token is rejected', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    route = () => ({ status: 401 })

    const request = expect(api.get('/sales/orders')).rejects.toMatchObject({ status: 401 })
    await vi.runAllTimersAsync()
    await request
    // Thử lại một lần sau khi chờ tab khác (nếu có) làm mới xong.
    expect(calls.filter((call) => call.url === '/auth/refresh')).toHaveLength(2)
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('uses the token another tab just stored instead of ending the session', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    route = (config) => {
      if (config.url === '/auth/refresh') {
        // Tab khác thắng cuộc đua: nó lưu token mới trong lúc tab này nhận 401.
        storeAuthToken('from-other-tab')
        return { status: 401 }
      }
      return config.headers?.Authorization === 'Bearer from-other-tab' ? { status: 200, data: 'ok' } : { status: 401 }
    }

    const request = api.get('/sales/orders')
    await vi.runAllTimersAsync()
    await expect(request).resolves.toBe('ok')
    expect(ended).not.toHaveBeenCalled()
  })

  it('keeps the session when the server is unreachable', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    route = (config) => (config.url === '/auth/refresh' ? { status: 503 } : { status: 401 })

    await expect(api.get('/sales/orders')).rejects.toMatchObject({ status: 401 })
    expect(ended).not.toHaveBeenCalled()
  })

  it('does not try to refresh failed logins', async () => {
    storeAuthToken(null)
    route = () => ({ status: 401 })

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({ status: 401 })
    expect(calls.map((call) => call.url)).toEqual(['/auth/login'])
  })
})
