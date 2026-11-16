import { describe, expect, it, vi } from 'vitest'
import { ApiRequestError, classifyApiError, httpApiError, legacyMutationFailure } from './apiErrors'
import { createApiTransport } from './apiTransport'
import { SessionResponseCache } from './sessionCache'
import type { Session } from '../types/session'

const session: Session = {
  token: 'test-token',
  sessionId: 'session-1',
  user: { id: 7, email: 'test@example.com', username: 'test', displayName: 'Test' },
}

function setup(request: (path: string, init?: RequestInit, id?: string) => Promise<Response>) {
  let current: Session | null = session
  const cache = new SessionResponseCache()
  const pendingRequests = new Set<symbol>()
  const mutationRequests = new Map<string, Promise<Response>>()
  const apiFetch = createApiTransport({
    cache, client: { request }, session, getSession: () => current,
    pendingRequests, mutationRequests,
  })
  return { apiFetch, cache, pendingRequests, mutationRequests, changeSession: (value: Session | null) => { current = value } }
}

describe('API error classification', () => {
  it('keeps HTTP failures separate from session expiration', () => {
    expect(httpApiError(new Response(null, { status: 403 }))?.kind).toBe('http')
    expect(httpApiError(new Response(null, { status: 401 }))?.kind).toBe('session-expired')
    expect(httpApiError(new Response(null, { status: 200 }))).toBeNull()
  })
  it('does not claim an ambiguous mutation is safe to retry', async () => {
    expect(classifyApiError(new TypeError('network'), true).kind).toBe('ambiguous-mutation')
    expect(classifyApiError(new Error('Phiên đăng nhập đã thay đổi.'), true).kind).toBe('session-changed')
    const response = legacyMutationFailure(new Error('network'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Chưa xác nhận được kết quả. Kiểm tra dữ liệu trước khi thử lại.' })
  })
})

describe('framework-independent API transport', () => {
  it('deduplicates cacheable GET requests and clones each response', async () => {
    let finish!: (response: Response) => void
    const requester = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve }))
    const { apiFetch } = setup(requester)
    const first = apiFetch('/api/posts')
    const second = apiFetch('/api/posts')
    finish(Response.json({ items: [1] }))
    expect(await (await first).json()).toEqual({ items: [1] })
    expect(await (await second).json()).toEqual({ items: [1] })
    expect(requester).toHaveBeenCalledTimes(1)
  })

  it('invalidates cached GET after a successful write', async () => {
    let reads = 0
    const { apiFetch } = setup(async (_path, init) => {
      if ((init?.method || 'GET') === 'GET') return Response.json({ index: ++reads })
      return Response.json({ ok: true })
    })
    expect(await (await apiFetch('/api/posts')).json()).toEqual({ index: 1 })
    expect(await (await apiFetch('/api/posts')).json()).toEqual({ index: 1 })
    await apiFetch('/api/posts', { method: 'POST', body: '{}' })
    expect(await (await apiFetch('/api/posts')).json()).toEqual({ index: 2 })
  })

  it('preserves legacy 503 response for an unconfirmed mutation', async () => {
    const { apiFetch, pendingRequests, mutationRequests } = setup(async () => { throw new TypeError('offline') })
    const response = await apiFetch('/api/posts', { method: 'POST', body: '{}' })
    expect(response.status).toBe(503)
    expect(pendingRequests.size).toBe(0)
    expect(mutationRequests.size).toBe(0)
  })

  it('rejects stale GET results after switching sessions', async () => {
    let finish!: (response: Response) => void
    const { apiFetch, changeSession } = setup(() => new Promise((resolve) => { finish = resolve }))
    const result = apiFetch('/api/posts')
    changeSession(null)
    finish(Response.json({ stale: true }))
    await expect(result).rejects.toBeInstanceOf(ApiRequestError)
  })
})
