import { SessionResponseCache, mutationTags } from '../shared/lib/sessionCache'
import { useRef, useState, type RefObject } from 'react'
import type { Session, createSessionClient } from '../features/auth/session'

type Options = {
  responseCache: RefObject<SessionResponseCache>
  session: Session | null
  sessionRef: RefObject<Session | null>
  sessionClient: ReturnType<typeof createSessionClient>
}

export function useApiRequest({
  responseCache,
  session,
  sessionRef,
  sessionClient,
}: Options) {
  const [pendingActions, setPendingActions] = useState(0)
  const pendingRequests = useRef(new Set<symbol>())
  const mutationRequests = useRef(new Map<string, Promise<Response>>())

  async function apiFetch(path: string, init: RequestInit = {}) {
    const sessionId = session?.sessionId
    const write = !['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase())
    const key = JSON.stringify([sessionId, path, init.method, init.body])
    const existing = write && mutationRequests.current.get(key)
    if (existing) return (await existing).clone()
    const cacheScope = sessionId ? `${session?.user.id}:${sessionId}` : ''
    responseCache.current.setScope(cacheScope)
    if (write) responseCache.current.invalidate(mutationTags(path))
    const method = (init.method || 'GET').toUpperCase()
    const operation = method === 'GET' && !init.signal && !init.headers && init.cache !== 'no-store'
      ? responseCache.current.read(cacheScope, path, performRequest, init.cache === 'reload' || init.cache === 'no-cache')
      : performRequest()
    if (write) mutationRequests.current.set(key, operation)
    try {
      const response = await operation
      if (sessionRef.current?.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã thay đổi.')
      return response.clone()
    }
    finally { if (mutationRequests.current.get(key) === operation) mutationRequests.current.delete(key) }

    async function performRequest() {
      const mutation = write && !/\/(read|translate|presign|subscription|bundle)$/.test(path)
        && !/^\/api\/conversations\/\d+\/category$/.test(path)
      const request = Symbol(path)
      if (mutation) {
        pendingRequests.current.add(request)
        setPendingActions(pendingRequests.current.size)
      }
      try {
        const response = await sessionClient.request(path, {
          ...init, signal: init.signal || AbortSignal.timeout(30_000),
        }, sessionId)
        // Consume the body before releasing pending state or accepting a stale session.
        await response.clone().text()
        if (sessionRef.current?.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã thay đổi.')
        if (write && response.ok) responseCache.current.invalidate(mutationTags(path))
        return response
      } catch (error) {
        if (!write) throw error
        const message = error instanceof Error && error.message === 'Phiên đăng nhập đã thay đổi.'
          ? error.message
          : 'Chưa xác nhận được kết quả. Kiểm tra dữ liệu trước khi thử lại.'
        return Response.json({ error: message }, { status: 503 })
      } finally {
        if (write && sessionRef.current?.sessionId === sessionId) responseCache.current.invalidate(mutationTags(path))
        pendingRequests.current.delete(request)
        if (sessionRef.current?.sessionId === sessionId) setPendingActions(pendingRequests.current.size)
      }
    }
  }


  return {
    apiFetch,
    pendingActions,
    setPendingActions,
    pendingRequests,
    mutationRequests,
  }
}