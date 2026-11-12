import { useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import { CHAT_LIST_PAGE_SIZE, type Conversation } from '../types'
import { useLatest } from '../../../shared/hooks/useLatest'

export type ConversationListFilter = 'all' | 'unread' | 'groups'

type SearchState = {
  key: string
  items: Conversation[]
  offset: number
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  error: string
}

const initialState: SearchState = {
  key: '', items: [], offset: 0, hasMore: false,
  loading: false, loadingMore: false, error: '',
}

export function useConversationListSearch({
  query, filter, categoryId, sessionId, enabled, request,
}: {
  query: string
  filter: ConversationListFilter
  categoryId: number | null
  sessionId?: string
  enabled: boolean
  request: ApiRequest
}) {
  const keyword = query.trim()
  const key = enabled && sessionId && keyword
    ? JSON.stringify([sessionId, keyword, filter, categoryId])
    : ''
  const requestRef = useLatest(request)
  const [state, setState] = useState<SearchState>(initialState)
  const [retry, setRetry] = useState(0)
  const pageController = useRef<AbortController | null>(null)
  const pageBusy = useRef(false)

  function path(offset: number) {
    const params = new URLSearchParams({
      q: keyword, limit: String(CHAT_LIST_PAGE_SIZE), offset: String(offset),
    })
    if (categoryId !== null) params.set('category', String(categoryId))
    if (filter === 'groups') params.set('type', 'group')
    if (filter === 'unread') params.set('unread', 'true')
    return '/api/conversations?' + params.toString()
  }

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    pageController.current?.abort()
    pageBusy.current = false
    setState({ ...initialState, key, loading: true })
    const timer = window.setTimeout(async () => {
      try {
        const response = await requestRef.current(path(0), {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error('Không thể tìm kiếm cuộc trò chuyện.')
        const items = await response.json() as Conversation[]
        if (controller.signal.aborted) return
        setState({
          key, items, offset: items.length,
          hasMore: items.length === CHAT_LIST_PAGE_SIZE,
          loading: false, loadingMore: false, error: '',
        })
      } catch {
        if (!controller.signal.aborted) {
          setState({ ...initialState, key, error: 'Không tải được kết quả tìm kiếm.' })
        }
      }
    }, 450)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      pageController.current?.abort()
      pageBusy.current = false
    }
    // The search key contains the query and all server-side filters.
  }, [key, retry])

  async function loadMore() {
    if (!key || state.key !== key || state.loading || state.loadingMore ||
        !state.hasMore || pageBusy.current) return
    pageBusy.current = true
    const controller = new AbortController()
    pageController.current = controller
    setState(current => current.key === key
      ? { ...current, loadingMore: true, error: '' } : current)
    try {
      const response = await requestRef.current(path(state.offset), {
        signal: controller.signal, cache: 'no-store',
      })
      if (!response.ok) throw new Error('Không tải thêm được kết quả tìm kiếm.')
      const items = await response.json() as Conversation[]
      if (controller.signal.aborted) return
      setState(current => {
        if (current.key !== key) return current
        const seen = new Set(current.items.map(item => item.id))
        return {
          ...current,
          items: [...current.items, ...items.filter(item => !seen.has(item.id))],
          offset: current.offset + items.length,
          hasMore: items.length === CHAT_LIST_PAGE_SIZE,
          loadingMore: false,
          error: '',
        }
      })
    } catch {
      if (!controller.signal.aborted) {
        setState(current => current.key === key
          ? { ...current, loadingMore: false, error: 'Không tải thêm được kết quả tìm kiếm.' }
          : current)
      }
    } finally {
      if (pageController.current === controller) pageController.current = null
      pageBusy.current = false
    }
  }

  return {
    active: Boolean(key),
    items: state.key === key ? state.items : [],
    loading: Boolean(key) && (state.key !== key || state.loading),
    loadingMore: state.key === key && state.loadingMore,
    hasMore: state.key === key && state.hasMore,
    error: state.key === key ? state.error : '',
    retry: () => setRetry(value => value + 1),
    loadMore,
  }
}
