import { useEffect, useRef, useState } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import { FEED_PAGE_SIZE, type Post } from '../types'
import { useLatest } from '../../../shared/hooks/useLatest'
import { appendUniquePosts } from '../utils/feedRequestState'

type State = {
  sessionId: string
  posts: Post[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string
  loaded: boolean
}
const empty = (sessionId: string): State => ({
  sessionId, posts: [], loading: false, loadingMore: false, hasMore: false, error: '', loaded: false,
})

export function useFollowingPosts({
  sessionId, enabled, request,
}: {
  sessionId?: string
  enabled: boolean
  request: ApiRequest
}) {
  const [refreshVersion, setRefreshVersion] = useState(0)
  // Every session and refresh belongs to a distinct visit. Late results from
  // a previous visit cannot overwrite current state, including A → B → A.
  const [state, setState] = useScopedState<State>(
    JSON.stringify([sessionId || '', enabled, refreshVersion]),
    empty(sessionId || ''),
  )
  const revision = useRef(0)
  const busy = useRef(false)
  const requestRef = useLatest(request)
  const current = state.sessionId === sessionId
    ? { ...state, loading: state.loading || (enabled && !state.loaded && !state.error) }
    : { ...empty(sessionId || ''), loading: enabled }

  useEffect(() => {
    if (!enabled || !sessionId) return
    let cancelled = false
    const id = ++revision.current
    busy.current = false
    const abort = new AbortController()
    void (async () => {
      try {
        const response = await requestRef.current('/api/posts?scope=following&limit=' + FEED_PAGE_SIZE, {
          signal: abort.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error('Không tải được bài viết từ bạn bè.')
        const posts = await response.json() as Post[]
        if (cancelled || id !== revision.current) return
        if (!Array.isArray(posts)) throw new Error('Danh sách bài viết không hợp lệ.')
        setState({ sessionId, posts, loading: false, loadingMore: false,
          hasMore: posts.length === FEED_PAGE_SIZE, error: '', loaded: true })
      } catch {
        if (!cancelled && id === revision.current) {
          setState(previous => previous.sessionId === sessionId
            ? { ...previous, loading: false, error: 'Không tải được bài viết từ bạn bè.', loaded: true }
            : previous)
        }
      }
    })()
    return () => { cancelled = true; abort.abort(); ++revision.current; busy.current = false }
  }, [enabled, sessionId, refreshVersion, requestRef, setState])

  async function loadMore() {
    if (!enabled || !sessionId || current.loading || current.loadingMore || !current.hasMore || busy.current || !current.posts.length) return
    const before = Math.min(...current.posts.map(post => post.id))
    busy.current = true
    const id = revision.current
    setState(previous => ({ ...previous, loadingMore: true, error: '' }))
    try {
      const response = await requestRef.current('/api/posts?scope=following&limit=' + FEED_PAGE_SIZE + '&before=' + before, { cache: 'no-store' })
      if (!response.ok) throw new Error('Không thể tải thêm bài viết.')
      const posts = await response.json() as Post[]
      if (id !== revision.current || !Array.isArray(posts)) return
      setState(previous => {
        if (previous.sessionId !== sessionId) return previous
        return {
          ...previous, posts: appendUniquePosts(previous.posts, posts),
          loadingMore: false, hasMore: posts.length === FEED_PAGE_SIZE, error: '',
        }
      })
    } catch {
      if (id === revision.current) setState(previous =>
        previous.sessionId === sessionId
          ? { ...previous, loadingMore: false, error: 'Không tải thêm được bài viết từ bạn bè.' }
          : previous)
    } finally {
      if (id === revision.current) busy.current = false
    }
  }

  function syncPost(post: Post) {
    setState(previous => previous.sessionId === sessionId
      ? { ...previous, posts: previous.posts.map(item => item.id === post.id ? post : item) }
      : previous)
  }
  function removePost(id: number) {
    setState(previous => previous.sessionId === sessionId
      ? { ...previous, posts: previous.posts.filter(post => post.id !== id) }
      : previous)
  }

  return {
    refresh: () => setRefreshVersion(value => value + 1),
    syncPost,
    removePost,
    posts: current.posts,
    loading: current.loading,
    loadingMore: current.loadingMore,
    hasMore: current.hasMore,
    error: current.error,
    loadMore,
  }
}
