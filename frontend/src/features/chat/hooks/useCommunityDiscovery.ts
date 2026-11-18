import { useEffect, useRef, useState } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { joinPublicGroup, listPublicGroups } from '../api/community'

export type CommunityMetadata = {
  id: number
  name: string
  description: string
  topic: string
  rules: string
  visibility: 'public' | 'private'
  memberCount: number
}

/** Discovery belongs to the list screen, not the selected community workspace. */
export function useCommunityDiscovery({
  active,
  query,
  request,
  notify,
  onJoinedGroup,
}: {
  active: boolean
  query: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string) => void
  onJoinedGroup: (id: number) => Promise<void>
}) {
  const [loadedGroups, setPublicGroups] = useScopedState<CommunityMetadata[] | null>(active ? query : null, null)
  const publicGroups = loadedGroups ?? []
  const publicLoading = active && loadedGroups === null
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const joiningRef = useRef(false)
  const requestRef = useLatest(request)
  const notifyRef = useLatest(notify)
  const onJoinedRef = useLatest(onJoinedGroup)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    void listPublicGroups(requestRef.current, query, controller.signal)
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được nhóm công khai')
        const value = await response.json() as CommunityMetadata[]
        if (!controller.signal.aborted) setPublicGroups(Array.isArray(value) ? value : [])
      })
      .catch(() => {
        if (!controller.signal.aborted) setPublicGroups([])
      })
    return () => controller.abort()
  }, [active, query, requestRef, setPublicGroups])

  async function joinPublic(id: number) {
    if (joiningRef.current) return
    joiningRef.current = true
    setJoiningId(id)
    try {
      const response = await joinPublicGroup(requestRef.current, id)
      const result = await response.json().catch(() => null) as {status?: string; error?: string} | null
      if (!response.ok) throw new Error(result?.error || 'Không tham gia được cộng đồng.')
      if (result?.status === 'member') {
        notifyRef.current('Đã tham gia cộng đồng.')
        await onJoinedRef.current(id)
      } else {
        notifyRef.current('Đã gửi yêu cầu tham gia. Chờ quản trị viên duyệt.')
      }
    } catch (error) {
      notifyRef.current(error instanceof Error ? error.message : 'Không thể tham gia cộng đồng.')
    } finally {
      joiningRef.current = false
      setJoiningId(null)
    }
  }

  return { publicGroups, publicLoading, joiningId, joinPublic }
}
