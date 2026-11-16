import { useEffect, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import type { Conversation } from '../types'
import { useLatest } from '../../../shared/hooks/useLatest'

export type ChatQuickContact = {
  id: number
  name: string
  username?: string
  conversation?: Conversation
}

export type ChatQuickHit = {
  id: number
  conversation: Conversation
  sender: string
  text: string
  createdAt: string
  attachmentId?: number
  fileName?: string
  fileKind?: string
}

export type ChatQuickResults = {
  contacts: ChatQuickContact[]
  messages: ChatQuickHit[]
  files: ChatQuickHit[]
}

const empty: ChatQuickResults = { contacts: [], messages: [], files: [] }

export function useChatQuickSearch({
  keyword, sessionId, enabled, request,
}: {
  keyword: string
  sessionId?: string
  enabled: boolean
  request: ApiRequest
}) {
  const query = keyword.trim()
  const key = enabled && sessionId && query ? JSON.stringify([sessionId, query]) : ''
  const requestRef = useLatest(request)
  const [state, setState] = useState({
    key: '', results: empty, loading: false, error: '',
  })
  const [retry, setRetry] = useState(0)
  const requestKey = key ? JSON.stringify([key, retry]) : ''

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await requestRef.current('/api/chat/search?q=' + encodeURIComponent(query), {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error('Không thể tìm kiếm')
        const results = (await response.json()) as ChatQuickResults
        if (!controller.signal.aborted) setState({ key: requestKey, results, loading: false, error: '' })
      } catch {
        if (!controller.signal.aborted) {
          setState({ key: requestKey, results: empty, loading: false, error: 'Không tải được kết quả tìm kiếm.' })
        }
      }
    }, 500)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [key, query, requestRef, requestKey])

  return {
    results: state.key === requestKey ? state.results : empty,
    loading: Boolean(key) && (state.key !== requestKey || state.loading),
    error: state.key === requestKey ? state.error : '',
    retry: () => setRetry(n => n + 1),
  }
}
