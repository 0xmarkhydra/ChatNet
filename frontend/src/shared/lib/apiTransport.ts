import type { Session } from '../types/session'
import { SessionResponseCache, mutationTags } from './sessionCache'
import { classifyApiError, legacyMutationFailure } from './apiErrors'

type SessionRequester = {
  request: (path: string, init?: RequestInit, sessionId?: string) => Promise<Response>
}

export type ApiTransportOptions = {
  cache: SessionResponseCache
  client: SessionRequester
  getSession: () => Session | null
  /** Session snapshot from the render that created the request handler. */
  session: Session | null
  pendingRequests: Set<symbol>
  mutationRequests: Map<string, Promise<Response>>
}

/**
 * Framework-independent implementation of the legacy apiFetch contract.
 * State refs remain owned by the React hook; this module never reads React state.
 */
export function createApiTransport(options: ApiTransportOptions) {
  const { cache, client, getSession, session, pendingRequests, mutationRequests } = options

  return async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const sessionId = session?.sessionId
    const method = (init.method || 'GET').toUpperCase()
    const write = method !== 'GET' && method !== 'HEAD'
    // Compatibility: preserve the existing in-flight write key, NOT an idempotency guarantee.
    const key = JSON.stringify([sessionId, path, init.method, init.body])
    const existing = write && mutationRequests.get(key)
    if (existing) return (await existing).clone()

    const scope = sessionId ? `${session?.user.id}:${sessionId}` : ''
    cache.setScope(scope)
    if (write) cache.invalidate(mutationTags(path))

    const operation = method === 'GET' && !init.signal && !init.headers && init.cache !== 'no-store'
      ? cache.read(scope, path, performRequest, init.cache === 'reload' || init.cache === 'no-cache')
      : performRequest()
    if (write) mutationRequests.set(key, operation)
    try {
      const response = await operation
      assertSameSession()
      return response.clone()
    } finally {
      if (mutationRequests.get(key) === operation) mutationRequests.delete(key)
    }

    function assertSameSession() {
      if (getSession()?.sessionId !== sessionId) throw classifyApiError(new Error('Phiên đăng nhập đã thay đổi.'))
    }

    async function performRequest(): Promise<Response> {
      const mutation = write && path !== '/api/profile/note' && !/\/(read|translate|presign|subscription|bundle)$/.test(path)
        && !/^\/api\/conversations\/\d+\/(category|messages)$/.test(path)
      const request = Symbol(path)
      if (mutation) pendingRequests.add(request)
      try {
        const response = await client.request(path, {
          ...init,
          signal: init.signal || AbortSignal.timeout(30_000),
        }, sessionId)
        // Keep the body-consumption barrier before clearing pending state.
        await response.clone().text()
        assertSameSession()
        if (write && response.ok) cache.invalidate(mutationTags(path))
        return response
      } catch (error) {
        if (!write) throw classifyApiError(error)
        return legacyMutationFailure(error)
      } finally {
        if (write && getSession()?.sessionId === sessionId) cache.invalidate(mutationTags(path))
        pendingRequests.delete(request)
      }
    }
  }
}
