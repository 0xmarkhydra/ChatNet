// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CallManager from './CallManager'

const mocks = vi.hoisted(() => ({ getCurrentCalls: vi.fn() }))

vi.mock('../lib/calls', () => ({
  createCall: vi.fn(),
  declineCall: vi.fn(),
  getCurrentCalls: mocks.getCurrentCalls,
}))
vi.mock('../../../platform/desktop', () => ({ isDesktopBuild: () => false }))
vi.mock('../../../platform/desktopMedia', () => ({ requireDesktopMedia: vi.fn() }))
vi.mock('../../notifications', () => ({ notifyDesktopCall: vi.fn(), dismissDesktopCall: vi.fn() }))
vi.mock('./IncomingCallDialog', () => ({ default: () => null }))
vi.mock('./SecureCallRoom', () => ({ default: () => null }))

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = environment.IS_REACT_ACT_ENVIRONMENT

beforeEach(() => {
  environment.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mocks.getCurrentCalls.mockReset().mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  environment.IS_REACT_ACT_ENVIRONMENT = previousAct
})

describe('CallManager SSE fallback', () => {
  it('shows polling fallback after permanent ticket failure and polls while visible', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const request = vi.fn(async (path: string) => path === '/api/events/ticket'
      ? new Response(null, { status: 404 })
      : Response.json([]))

    try {
      await act(async () => {
        root.render(<CallManager
          request={request} apiBase="https://api.example.test" token="token" sessionId="session"
          userId={1} sourceLanguage="en" targetLanguage="vi" conversations={[]}
        />)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(request).toHaveBeenCalledWith('/api/events/ticket', expect.any(Object))
      expect(host.querySelector('[role="alert"]')?.textContent)
        .toContain('Hệ thống sẽ kiểm tra cuộc gọi khi ứng dụng đang hiển thị.')
      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(1)

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(2)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('pauses polling while hidden and refreshes when window regains focus', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const request = vi.fn(async (path: string) => path === '/api/events/ticket'
      ? new Response(null, { status: 404 })
      : Response.json([]))

    try {
      await act(async () => {
        root.render(<CallManager
          request={request} apiBase="https://api.example.test" token="token" sessionId="session"
          userId={1} sourceLanguage="en" targetLanguage="vi" conversations={[]}
        />)
      })
      expect(host.querySelector('[role="alert"]')?.textContent)
        .toContain('khi ứng dụng đang hiển thị.')
      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(1)

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(1)

      visibility.mockReturnValue('visible')
      await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(2)

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(mocks.getCurrentCalls).toHaveBeenCalledTimes(3)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
