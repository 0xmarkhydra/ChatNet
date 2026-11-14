// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionResponseCache } from '../../shared/lib/sessionCache'
import type { Session } from '../../shared/types/session'
import { useApiRequest } from './useApiRequest'

const account = (letter: string, token = 'token-' + letter): Session => ({
  token, sessionId: 'session-' + letter,
  user: { id: letter === 'A' ? 1 : 2, email: letter + '@example.test', username: letter, displayName: letter },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

function mountApi() {
  const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const sessionRef = { current: account('A') as Session | null }
  const responseCache = { current: new SessionResponseCache() }
  const pending: Array<ReturnType<typeof deferred<Response>>> = []
  const request = vi.fn(() => {
    const item = deferred<Response>()
    pending.push(item)
    return item.promise
  })
  const client = { request }
  let api!: ReturnType<typeof useApiRequest>
  function Probe({ session }: { session: Session }) {
    api = useApiRequest({
      session, sessionRef, responseCache, sessionClient: client,
    } as unknown as Parameters<typeof useApiRequest>[0])
    return null
  }
  return {
    get api() { return api },
    pending, request, sessionRef,
    async render(session: Session) {
      sessionRef.current = session
      await act(async () => root.render(<Probe session={session} />))
    },
    async close() {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('app API request visit ownership', () => {
  it('rejects a stale GET result after switching A → B → A', async () => {
    const probe = mountApi()
    try {
      await probe.render(account('A'))
      const oldGet = probe.api.apiFetch('/api/posts', { cache: 'no-store' })
      const staleGet = expect(oldGet).rejects.toThrow('Phiên đăng nhập đã thay đổi.')
      await probe.render(account('B'))
      await probe.render(account('A'))
      await act(async () => {
        probe.pending[0].resolve(Response.json([{ id: 1 }]))
        await Promise.resolve()
      })
      await staleGet
    } finally {
      await probe.close()
    }
  })

  it('does not deduplicate a new A mutation against an old A visit still in flight', async () => {
    const probe = mountApi()
    try {
      await probe.render(account('A'))
      const oldWrite = probe.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
      const staleWrite = expect(oldWrite).rejects.toThrow('Phiên đăng nhập đã thay đổi.')
      expect(probe.request).toHaveBeenCalledTimes(1)
      await probe.render(account('B'))
      await probe.render(account('A'))
      const newWrite = probe.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
      expect(probe.request).toHaveBeenCalledTimes(2)
      await act(async () => {
        probe.pending[0].resolve(Response.json({ old: true }))
        probe.pending[1].resolve(Response.json({ fresh: true }))
        await Promise.resolve()
      })
      await staleWrite
      expect(await (await newWrite).json()).toEqual({ fresh: true })
    } finally {
      await probe.close()
    }
  })

  it('keeps in-flight mutation deduplication when only the token refreshes', async () => {
    const probe = mountApi()
    try {
      await probe.render(account('A'))
      const first = probe.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
      await probe.render(account('A', 'refreshed-token'))
      const duplicate = probe.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
      expect(probe.request).toHaveBeenCalledTimes(1)
      await act(async () => {
        probe.pending[0].resolve(Response.json({ saved: true }))
        await Promise.resolve()
      })
      expect(await (await first).json()).toEqual({ saved: true })
      expect(await (await duplicate).json()).toEqual({ saved: true })
    } finally {
      await probe.close()
    }
  })
  it('does not send a request when an old callback fires after returning to account A', async () => {
    const probe = mountApi()
    try {
      await probe.render(account('A'))
      const oldFetch = probe.api.apiFetch
      await probe.render(account('B'))
      await probe.render(account('A'))
      const staleWrite = await oldFetch('/api/posts', { method: 'POST', body: '{}' })
      expect(staleWrite.status).toBe(503)
      await expect(oldFetch('/api/posts', { cache: 'no-store' })).rejects.toThrow('Phiên đăng nhập đã thay đổi.')
      expect(probe.request).not.toHaveBeenCalled()
    } finally {
      await probe.close()
    }
  })

})
