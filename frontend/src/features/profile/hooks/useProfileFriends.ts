import { useCallback, useEffect, useRef } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import { listFriends, type FriendConnection } from '../../contacts'

type Options = {
  apiFetch: ApiRequest
  enabled: boolean
  initialFriends: FriendConnection[]
  sessionId: string
}

export function useProfileFriends({ apiFetch, enabled, initialFriends, sessionId }: Options) {
  const [loadedFriends, setLoadedFriends] = useScopedState<FriendConnection[]>(sessionId, [])
  const [loaded, setLoaded] = useScopedState(sessionId, false)
  const [loading, setLoading] = useScopedState(sessionId, false)
  const [error, setError] = useScopedState(sessionId, false)
  const request = useRef<AbortController | null>(null)

  const loadFriends = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await listFriends(apiFetch, controller.signal)
      if (!response.ok) throw new Error('Unable to load profile friends')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Invalid profile friends response')
      if (controller.signal.aborted) return
      setLoadedFriends(data as FriendConnection[])
      setLoaded(true)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [apiFetch, setError, setLoaded, setLoadedFriends, setLoading])

  useEffect(() => {
    if (!enabled || initialFriends.length > 0 || loaded) return
    void loadFriends()
    return () => request.current?.abort()
  }, [enabled, initialFriends.length, loaded, loadFriends])

  return {
    friends: initialFriends.length > 0 ? initialFriends : loadedFriends,
    loading: loading || (enabled && initialFriends.length === 0 && !loaded && !error),
    error,
    reload: loadFriends,
  }
}
