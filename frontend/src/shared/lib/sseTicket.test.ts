import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSseTicketWithRetry } from './sseTicket'

afterEach(() => vi.useRealTimers())

describe('SSE ticket retry', () => {
  it('waits before requesting a replacement ticket after a stream failure', async () => {
    vi.useFakeTimers()
    const apiFetch = vi.fn().mockResolvedValue(Response.json({ ticket: 't'.repeat(43) }))
    const controller = new AbortController()
    const pending = requestSseTicketWithRetry(apiFetch, controller.signal, 1000)

    expect(apiFetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(999)
    expect(apiFetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBe('t'.repeat(43))
    expect(apiFetch).toHaveBeenCalledOnce()
  })

  it('honors Retry-After before requesting another ticket', async () => {
    vi.useFakeTimers()
    const apiFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(Response.json({ ticket: 't'.repeat(43) }))
    const controller = new AbortController()
    const pending = requestSseTicketWithRetry(apiFetch, controller.signal)

    expect(apiFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(apiFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBe('t'.repeat(43))
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry permanent ticket errors', async () => {
    const apiFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    const controller = new AbortController()

    await expect(requestSseTicketWithRetry(apiFetch, controller.signal)).rejects.toThrow('realtime ticket unavailable')
    expect(apiFetch).toHaveBeenCalledOnce()
  })

  it('stops after five retryable ticket failures', async () => {
    vi.useFakeTimers()
    const apiFetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    const controller = new AbortController()
    const pending = requestSseTicketWithRetry(apiFetch, controller.signal)
    const rejected = expect(pending).rejects.toThrow('realtime ticket unavailable')

    await vi.runAllTimersAsync()
    await rejected
    expect(apiFetch).toHaveBeenCalledTimes(5)
  })

  it('stops waiting when its owner aborts', async () => {
    vi.useFakeTimers()
    const apiFetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    const controller = new AbortController()
    const pending = requestSseTicketWithRetry(apiFetch, controller.signal)

    expect(apiFetch).toHaveBeenCalledTimes(1)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
