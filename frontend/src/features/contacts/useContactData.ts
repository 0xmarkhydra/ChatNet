import { useRef, useState } from 'react'
import type { AppDataContext } from '../../app/dataTypes'
import type { FriendConnection } from './types'
type Options = AppDataContext
export function useContactData({
  session,
  sessionRef,
  apiFetch,
  setStatus,
  setNotice,
}: Options) {
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendConnection[]>([])
  const [contactMetadata, setContactMetadata] = useState<Record<number, { nickname: string; note: string; favorite: boolean }>>({})
  const friendSyncRequest = useRef(0)
  const [friendSyncSessionId, setFriendSyncSessionId] = useState('')
  const [friendSyncError, setFriendSyncError] = useState('')
  const [friendSyncBusy, setFriendSyncBusy] = useState(false)

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
      const [friendsResponse, requestsResponse, metadataResponse] = await Promise.all([
        apiFetch('/api/friends'),
        apiFetch('/api/friends/requests'),
        apiFetch('/api/contacts'),
      ])
      if (!friendsResponse.ok || !requestsResponse.ok) throw new Error('Friend sync failed')
      const [nextFriends, nextRequests] = await Promise.all([
        friendsResponse.json() as Promise<FriendConnection[]>,
        requestsResponse.json() as Promise<FriendConnection[]>,
      ])
      if (sessionRef.current?.sessionId !== sessionId || request !== friendSyncRequest.current) return
      setFriends(nextFriends)
      setFriendRequests(nextRequests)
      if (metadataResponse.ok) {
        const records = await metadataResponse.json() as Array<{ id: number; nickname: string; note: string; favorite: boolean }>
        if (sessionRef.current?.sessionId !== sessionId || request !== friendSyncRequest.current) return
        setContactMetadata(Object.fromEntries(records.map((item) => [item.id, {
          nickname: item.nickname, note: item.note, favorite: item.favorite,
        }])))
      }
      setFriendSyncSessionId(sessionId)
      setFriendSyncError('')
    } catch {
      if (sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current) {
        setFriendSyncError('Chưa tải được trạng thái kết bạn.')
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