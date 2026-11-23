import { useEffect, useRef, useState } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import { search, type SearchSort } from '../api/search'

const PAGE_SIZE = 10
const emptyState = { key: '', items: [], loading: false, loadingMore: false, nextCursor: null, error: '' }
type State<T> = {
  key: string
  items: T[]
  loading: boolean
  loadingMore: boolean
  nextCursor: string | null
  error: string
}
export type SearchResults<T> = State<T> & {
  hasMore: boolean
  loadMore: () => Promise<void>
  retry: () => void
}

export function useSearchResults<T extends { id: number }>({
  endpoint, query, sort, since, enabled, sessionId, request,
}: {
  endpoint: string
  query: string
  sort: SearchSort
  since?: string
  enabled: boolean
  sessionId: string
  request: ApiRequest
}) {
  const normalizedQuery = query.trim().slice(0, 120)
  const key = enabled && sessionId && normalizedQuery
    ? JSON.stringify([sessionId, endpoint, normalizedQuery, sort, since ?? '']) : ''
  const requestRef = useLatest(request)
  const currentKey = useLatest(key)
  const pageController = useRef<AbortController | null>(null)
  const pageBusy = useRef(false)
  const [retryNumber, setRetryNumber] = useState(0)
  const [stored, setStored] = useScopedState<State<T>>(JSON.stringify([key, retryNumber]), emptyState)

  useEffect(() => {
    pageController.current?.abort()
    pageController.current = null
    pageBusy.current = false
    if (!key) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void search<T>(requestRef.current, endpoint, {
        query: normalizedQuery, limit: PAGE_SIZE, sort, since, signal: controller.signal,
      }).then(page => {
        if (controller.signal.aborted || currentKey.current !== key) return
        setStored({ key, items: page.items, loading: false, loadingMore: false, nextCursor: page.nextCursor, error: '' })
      }).catch((error: unknown) => {
        if (controller.signal.aborted || currentKey.current !== key) return
        setStored({ ...emptyState, key, error: error instanceof Error ? error.message : 'Không thể tải kết quả tìm kiếm.' })
      })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
      pageController.current?.abort()
      pageController.current = null
      pageBusy.current = false
    }
  }, [key, endpoint, normalizedQuery, sort, since, retryNumber, requestRef, currentKey, setStored])

  const state = stored.key === key ? stored : { ...emptyState, loading: Boolean(key) } as State<T>

  async function loadMore() {
    const cursor = state.nextCursor
    if (!key || state.key !== key || !cursor || pageBusy.current || state.loading || state.error) return
    pageBusy.current = true
    const controller = new AbortController()
    pageController.current = controller
    setStored(previous => previous.key === key ? { ...previous, loadingMore: true } : previous)
    try {
      const page = await search<T>(requestRef.current, endpoint, {
        query: normalizedQuery, limit: PAGE_SIZE, sort, since, cursor, signal: controller.signal,
      })
      if (controller.signal.aborted || currentKey.current !== key) return
      setStored(previous => {
        if (previous.key !== key) return previous
        const ids = new Set(previous.items.map(item => item.id))
        const additions = page.items.filter(item => {
          if (ids.has(item.id)) return false
          ids.add(item.id)
          return true
        })
        return {
          ...previous,
          items: [...previous.items, ...additions],
          nextCursor: page.nextCursor,
          loadingMore: false,
        }
      })
    } catch (error) {
      if (!controller.signal.aborted && currentKey.current === key) {
        setStored(previous => previous.key === key ? {
          ...previous, loadingMore: false,
          error: error instanceof Error ? error.message : 'Không thể tải thêm kết quả.',
        } : previous)
      }
    } finally {
      if (pageController.current === controller) {
        pageController.current = null
        pageBusy.current = false
      }
    }
  }

  return {
    ...state,
    hasMore: Boolean(state.nextCursor),
    loadMore,
    retry: () => setRetryNumber(value => value + 1),
  }
}
