import { useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import type { Conversation } from '../types'

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
  const requestRef = useRef(request)
  requestRef.current = request
  const [state, setState] = useState({
    key: '', results: empty, loading: false, error: '',
  })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    setState({ key, results: empty, loading: true, error: '' })
    const timer = window.setTimeout(async () => {
      try {
        const response = await requestRef.current('/api/chat/search?q=' + encodeURIComponent(query), {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error('Không thể tìm kiếm')
        const results = (await response.json()) as ChatQuickResults
        if (!controller.signal.aborted) setState({ key, results, loading: false, error: '' })
      } catch {
        if (!controller.signal.aborted) {
          setState({ key, results: empty, loading: false, error: 'Không tải được kết quả tìm kiếm.' })
        }
      }
    }, 500)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [key, query, retry])

  return {
    results: state.key === key ? state.results : empty,
    loading: Boolean(key) && (state.key !== key || state.loading),
    error: state.key === key ? state.error : '',
    retry: () => setRetry(n => n + 1),
  }
}
