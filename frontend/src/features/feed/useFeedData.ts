import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../app/dataTypes'
import { FEED_PAGE_SIZE, type Post, type Story } from './types'
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
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [hasMoreSavedPosts, setHasMoreSavedPosts] = useState(false)
  const [savedPostsBusy, setSavedPostsBusy] = useState(false)
  const savedPagingBusy = useRef(false)
  const [hasMorePosts, setHasMorePosts] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const postsPagingBusy = useRef(false)
  const [stories, setStories] = useState<Story[]>([])

  async function refreshPosts() {
    const revision = feedRevision.current
    const request = ++feedLoads.current
    const sessionId = session?.sessionId
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}`)
      if (!response.ok) return
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.sessionId !== sessionId ||
        revision !== feedRevision.current || request !== feedLoads.current ||
        [...actionLocks.current].some((key) => key.startsWith('feed:'))) return
      setPosts((current) => {
        const ids = new Set(data.map((item) => item.id))
        return [...data, ...current.filter((item) => !ids.has(item.id))]
      })
      if (data.length < FEED_PAGE_SIZE) setHasMorePosts(false)
      else if (posts.length === 0) setHasMorePosts(true)
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function loadMorePosts() {
    if (!session || postsPagingBusy.current || !hasMorePosts || posts.length === 0) return
    const sessionId = session.sessionId
    const before = Math.min(...posts.map((item) => item.id))
    postsPagingBusy.current = true
    setPostsLoadingMore(true)
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}&before=${before}`)
      if (!response.ok) throw new Error('Không tải thêm được bài viết')
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.sessionId !== sessionId) return
      setHasMorePosts(data.length === FEED_PAGE_SIZE)
      setPosts((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...current, ...data.filter((item) => !ids.has(item.id))]
      })
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setNotice('Không tải thêm được bài viết. Hãy thử lại.', 'error')
    } finally {
      postsPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setPostsLoadingMore(false)
    }
  }

  async function loadSavedPosts(more = false) {
    if (!session || savedPagingBusy.current) return
    const sessionId = session.sessionId
    savedPagingBusy.current = true
    setSavedPostsBusy(true)
    try {
      const before = more && savedPosts.length ? '&before=' + Math.min(...savedPosts.map(p => p.id)) : ''
      const response = await apiFetch('/api/posts?scope=saved&limit=' + FEED_PAGE_SIZE + before)
      if (!response.ok) throw new Error('Không tải được các bài đã lưu.')
      const data = await response.json() as Post[]
      if (sessionRef.current?.sessionId !== sessionId) return
      setSavedPosts(current => {
        if (!more) return data
        const ids = new Set(current.map(p => p.id))
        return [...current, ...data.filter(p => !ids.has(p.id))]
      })
      setHasMoreSavedPosts(data.length === FEED_PAGE_SIZE)
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không tải được bài đã lưu.', 'error')
    } finally {
      savedPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setSavedPostsBusy(false)
    }
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

  async function refreshStories() {
    try {
      const response = await apiFetch('/api/stories')
      if (!response.ok) return
      const data = (await response.json()) as Story[]
      if (sessionRef.current?.sessionId === session?.sessionId) {
        setStories(data.filter((item) => Date.parse(item.expiresAt) > Date.now()))
      }
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }



  return {
    feedRevision,
    feedLoads,
    posts,
    setPosts,
    savedPosts,
    setSavedPosts,
    hasMoreSavedPosts,
    setHasMoreSavedPosts,
    savedPostsBusy,
    setSavedPostsBusy,
    savedPagingBusy,
    hasMorePosts,
    setHasMorePosts,
    postsLoadingMore,
    setPostsLoadingMore,
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
