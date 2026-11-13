import { useRef } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { AppDataContext } from '../../../shared/types/api'
import type { FriendConnection } from '../types'
import { listFriendRequests, listContactMetadata, listFriends } from '../api/contacts'
type Options = AppDataContext
export function useContactData({
  session,
  sessionRef,
  apiFetch,
  setStatus,
  setNotice,
}: Options) {
  const scope = session?.sessionId || ''
  const [friends, setFriends] = useScopedState<FriendConnection[]>(scope, [])
  const [friendRequests, setFriendRequests] = useScopedState<FriendConnection[]>(scope, [])
  const [contactMetadata, setContactMetadata] = useScopedState<Record<number, { nickname: string; note: string; favorite: boolean }>>(scope, {})
  const friendSyncRequest = useRef(0)
  const [friendSyncSessionId, setFriendSyncSessionId] = useScopedState(scope, '')
  const [friendSyncError, setFriendSyncError] = useScopedState(scope, '')
  const [friendSyncBusy, setFriendSyncBusy] = useScopedState(scope, false)

  const friendSyncFlight = useRef<{ sessionId: string; revision: number; promise: Promise<void> } | null>(null)
  async function refreshFriendConnections() {
    const sessionId = sessionRef.current?.sessionId
    if (!sessionId) return
    const active = friendSyncFlight.current
    if (active?.sessionId === sessionId && active.revision === friendSyncRequest.current) return active.promise
    const promise = fetchFriendConnections()
    const flight = { sessionId, revision: friendSyncRequest.current, promise }
    friendSyncFlight.current = flight
    try { await promise }
    finally { if (friendSyncFlight.current === flight) friendSyncFlight.current = null }
  }
  async function fetchFriendConnections() {
    const sessionId = session?.sessionId
    if (!sessionId) return
    const request = ++friendSyncRequest.current
    setFriendSyncBusy(true)
    try {
      // Load the primary friend list independently. A slow or unavailable
      // requests/metadata endpoint must not delay friends on mobile.
      const isCurrent = () =>
        sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current
      void listFriendRequests(apiFetch)
        .then(async (response) => {
          if (!response.ok) return
          const items: unknown = await response.json().catch(() => null)
          if (isCurrent() && Array.isArray(items)) setFriendRequests(items as FriendConnection[])
        }).catch(() => undefined)
      void listContactMetadata(apiFetch)
        .then(async (response) => {
          if (!response.ok) return
          const records: unknown = await response.json().catch(() => null)
          if (isCurrent() && Array.isArray(records)) {
            setContactMetadata(Object.fromEntries(
              (records as Array<{ id: number; nickname: string; note: string; favorite: boolean }>)
                .map((item) => [item.id, {
                  nickname: item.nickname, note: item.note, favorite: item.favorite,
                }]),
            ))
          }
        }).catch(() => undefined)
      const friendsResponse = await listFriends(apiFetch)
      if (!isCurrent()) return
      if (!friendsResponse.ok) {
        throw new Error('Không thể tải danh sách bạn bè. Kiểm tra kết nối và thử lại.')
      }
      const nextFriends: unknown = await friendsResponse.json()
      if (!Array.isArray(nextFriends)) throw new Error('Dữ liệu bạn bè từ máy chủ không hợp lệ.')
      if (!isCurrent()) return
      setFriends(nextFriends as FriendConnection[])
      setFriendSyncSessionId(sessionId)
      setFriendSyncError('')
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current) {
        setFriendSyncError(error instanceof Error ? error.message : 'Chưa tải được danh sách bạn bè.')
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current) setFriendSyncBusy(false)
    }
  }

  return {
    friends,
    setFriends,
    friendRequests,
    setFriendRequests,
    contactMetadata,
    setContactMetadata,
    friendSyncRequest,
    friendSyncSessionId,
    setFriendSyncSessionId,
    friendSyncError,
    setFriendSyncError,
    friendSyncBusy,
    setFriendSyncBusy,
    refreshFriendConnections,
  }
}