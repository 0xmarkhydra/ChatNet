import { useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import { exploreHttpError, joinExploreCommunity, listExploreCommunities, type PublicCommunity } from '../api/explore'

type LoadState = { status: 'loading' | 'ready' | 'error'; items: PublicCommunity[]; error: string }

export function useExploreCommunities(request: ApiRequest, sessionId: string, active: boolean) {
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading', items: [], error: '' })
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [joinMessage, setJoinMessage] = useState('')
  const joiningRef = useRef(false)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    void listExploreCommunities(request, controller.signal).then(async response => {
      if (!response.ok) throw exploreHttpError(response, 'Không tải được cộng đồng công khai.')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Dữ liệu cộng đồng không hợp lệ.')
      const items = data.filter((item): item is PublicCommunity =>
        typeof item === 'object' && item !== null && typeof item.id === 'number' &&
        typeof item.name === 'string' && item.visibility === 'public')
      if (!controller.signal.aborted) setState({ status: 'ready', items, error: '' })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState(previous => ({
        ...previous, status: 'error',
        error: error instanceof Error ? error.message : 'Không tải được cộng đồng.',
      }))
    })
    return () => controller.abort()
  }, [active, request, sessionId, refresh])

  async function join(id: number) {
    if (joiningRef.current) return
    joiningRef.current = true
    setJoiningId(id)
    setJoinMessage('')
    try {
      const response = await joinExploreCommunity(request, id)
      const result = await response.json().catch(() => null) as { status?: string; error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'Không tham gia được cộng đồng.')
      setJoinMessage(result?.status === 'member' ? 'Đã tham gia cộng đồng.' : 'Đã gửi yêu cầu, đang chờ quản trị viên duyệt.')
      setState(previous => ({ ...previous, items: previous.items.filter(item => item.id !== id) }))
    } catch (error) {
      setJoinMessage(error instanceof Error ? error.message : 'Không thể tham gia cộng đồng.')
    } finally {
      joiningRef.current = false
      setJoiningId(null)
    }
  }

  return { ...state, joiningId, joinMessage, join, retry: () => { setState(previous => ({ ...previous, status: 'loading', error: '' })); setRefresh(value => value + 1) } }
}