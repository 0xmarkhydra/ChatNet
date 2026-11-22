import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../../shared/types/api'
import { FEED_PAGE_SIZE, type Post } from '../types'
import { useFeedStories } from './useFeedStories'
import { appendUniquePosts, isCurrentFeedRefresh } from '../utils/feedRequestState'
import { useLatest } from '../../../shared/hooks/useLatest'
type Options = AppDataContext & {
  actionLocks: RefObject<Set<string>>
  setActivePostId: Dispatch<SetStateAction<number | null>>
}
export function useFeedData({
  session,
  sessionRef,
  apiFetch,
  setStatus,
  setNotice,
  actionLocks,
  setActivePostId,
}: Options) {
  const feedRevision = useRef(0)
  const feedLoads = useRef(0)
  const [posts, setPosts] = useState<Post[]>([])
  const postsLengthRef = useLatest(posts.length)
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [hasMoreSavedPosts, setHasMoreSavedPosts] = useState(false)
  const [savedPostsBusy, setSavedPostsBusy] = useState(false)
  const [savedLoadedSession, setSavedLoadedSession] = useState<string | null>(null)
  const savedQuery = useRef<{ sessionId: string; pending: boolean; loadedAt: number } | null>(null)
  const [hasMorePosts, setHasMorePosts] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const [postsPagingError, setPostsPagingError] = useState(false)
  const [savedPagingError, setSavedPagingError] = useState(false)
  const postsPagingBusy = useRef(false)
  const { stories, setStories, refreshStories } = useFeedStories({ session, sessionRef, apiFetch, setStatus, setNotice })

  async function refreshPosts() {
    const revision = feedRevision.current
    const request = ++feedLoads.current
    const sessionId = session?.sessionId
    const isCurrentRefresh = () => isCurrentFeedRefresh(
      { sessionId, revision, sequence: request },
      { sessionId: sessionRef.current?.sessionId, revision: feedRevision.current, sequence: feedLoads.current },
    )
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}`)
      if (!response.ok) {
        if (isCurrentRefresh() && postsLengthRef.current === 0) setPostsPagingError(true)
        return
      }
      const data = (await response.json()) as Post[]
      if (!isCurrentRefresh() ||
        [...actionLocks.current].some((key) => key.startsWith('feed:'))) return
      setPosts((current) => {
        const ids = new Set(data.map((item) => item.id))
        return [...data, ...current.filter((item) => !ids.has(item.id))]
      })
      if (postsLengthRef.current === 0) setPostsPagingError(false)
      if (data.length < FEED_PAGE_SIZE) setHasMorePosts(false)
      else if (postsLengthRef.current === 0) setHasMorePosts(true)
    } catch {
      if (!isCurrentRefresh()) return
      if (postsLengthRef.current === 0) setPostsPagingError(true)
      setStatus('Đang kết nối lại...')
    }
  }

  async function loadMorePosts() {
    if (!session || postsPagingBusy.current || !hasMorePosts || posts.length === 0) return
    const sessionId = session.sessionId
    const before = Math.min(...posts.map((item) => item.id))
    postsPagingBusy.current = true
    setPostsLoadingMore(true)
    setPostsPagingError(false)
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}&before=${before}`)
      if (!response.ok) throw new Error('Không tải thêm được bài viết')
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.sessionId !== sessionId) return
      setHasMorePosts(data.length === FEED_PAGE_SIZE)
      setPosts(current => appendUniquePosts(current, data))
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setPostsPagingError(true)
        setNotice('Không tải thêm được bài viết. Hãy thử lại.', 'error')
      }
    } finally {
      postsPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setPostsLoadingMore(false)
    }
  }

  async function loadSavedPosts(more = false, mode: 'open' | 'refresh' = 'open') {
    if (!session) return
    const sessionId = session.sessionId
    const query = savedQuery.current?.sessionId === sessionId
      ? savedQuery.current
      : { sessionId, pending: false, loadedAt: 0 }
    if (query.pending || (more && (!hasMoreSavedPosts || savedPosts.length === 0))) return
    // Match the session response cache's feed freshness window.
    if (!more && mode !== 'refresh' && Date.now() - query.loadedAt < 15_000) return
    savedQuery.current = query
    const current = () => savedQuery.current === query && sessionRef.current?.sessionId === sessionId
    query.pending = true
    setSavedPostsBusy(true)
    setSavedPagingError(false)
    try {
      const before = more ? '&before=' + Math.min(...savedPosts.map(p => p.id)) : ''
      const response = await apiFetch('/api/posts?scope=saved&limit=' + FEED_PAGE_SIZE + before,
        mode === 'refresh' ? { cache: 'reload' } : {})
      if (!response.ok) throw new Error('Không tải được các bài đã lưu.')
      const data = await response.json() as Post[]
      if (!current()) return
      setSavedPosts(existing => more ? appendUniquePosts(existing, data) : data)
      setHasMoreSavedPosts(data.length === FEED_PAGE_SIZE)
      if (!more) {
        setSavedLoadedSession(sessionId)
        query.loadedAt = Date.now()
      }
    } catch {
      if (current()) setSavedPagingError(true)
    } finally {
      query.pending = false
      if (current()) setSavedPostsBusy(false)
    }
  }

  function resetSavedPosts() {
    savedQuery.current = null
    setSavedPosts([])
    setHasMoreSavedPosts(false)
    setSavedPostsBusy(false)
    setSavedLoadedSession(null)
    setSavedPagingError(false)
  }

  function syncFeedPost(updated: Post) {
    setPosts(current => current.map(p => p.id === updated.id ? updated : p))
    setSavedPosts(current => {
      if (!updated.saved) return current.filter(p => p.id !== updated.id)
      const exists = current.some(p => p.id === updated.id)
      return exists ? current.map(p => p.id === updated.id ? updated : p) : [updated, ...current]
    })
  }

  function removeFeedPost(id: number) {
    setPosts(current => current.filter(p => p.id !== id))
    setSavedPosts(current => current.filter(p => p.id !== id))
    setActivePostId(current => current === id ? null : current)
  }

  return {
    feedRevision,
    feedLoads,
    posts,
    setPosts,
    savedPosts,
    setSavedPosts,
    hasMoreSavedPosts,
    savedPostsBusy,
    savedPostsLoaded: savedLoadedSession === session?.sessionId,
    resetSavedPosts,
    hasMorePosts,
    setHasMorePosts,
    postsLoadingMore,
    setPostsLoadingMore,
    postsPagingError,
    savedPagingError,
    postsPagingBusy,
    stories,
    setStories,
    refreshPosts,
    loadMorePosts,
    loadSavedPosts,
    syncFeedPost,
    removeFeedPost,
    refreshStories,
  }
}