// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedPagingOrchestration } from './useFeedPagingOrchestration'
import type { useFollowingPosts } from './useFollowingPosts'

const mockSearch = vi.hoisted(() => ({
  loadMore: vi.fn(),
  status: { loading: false, loadingMore: false, hasMore: true, error: '' },
}))
const observer = vi.hoisted(() => ({ current: null as null | { onLoadMore: () => void; hasMore: boolean; loading: boolean; error: boolean; enabled: boolean } }))
vi.mock('./usePostSearch', () => ({
  usePostSearch: () => ({
    ...mockSearch.status, posts: [], loadMore: mockSearch.loadMore, retry: vi.fn(),
  }),
}))
vi.mock('./useFeedInfiniteScroll', () => ({
  useFeedInfiniteScroll: (options: NonNullable<typeof observer.current>) => {
    observer.current = options
    return { current: null }
  },
}))

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(() => {
  vi.useRealTimers()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
})

describe('useFeedPagingOrchestration', () => {
  async function withFeed(run: (props: { render: (query?: string, filter?: 'all' | 'saved' | 'following') => Promise<void>; saved: ReturnType<typeof vi.fn>; more: ReturnType<typeof vi.fn>; followingMore: ReturnType<typeof vi.fn> }) => Promise<void>) {
    const el = document.createElement('div')
    document.body.append(el)
    const root = createRoot(el)
    const saved = vi.fn(async (_more?: boolean) => {})
    const more = vi.fn(async () => {})
    const followingMore = vi.fn(async () => {})
    const following = { posts: [], loading: false, loadingMore: false, hasMore: true, error: '', loadMore: followingMore } as unknown as ReturnType<typeof useFollowingPosts>
    function Probe({ query, filter }: { query: string; filter: 'all' | 'saved' | 'following' }) {
      const state = useFeedPagingOrchestration({
        tab: 'feed', sessionId: 'session-A', globalSearch: query,
        feedFilter: filter, request: vi.fn(),
        followingFeed: following, savedPostsLoaded: false,
        savedPagingError: false, savedPostsBusy: false, postsLoadingMore: false,
        postsPagingError: false, searchHasScrolled: true,
        hasMoreSavedPosts: true, hasMorePosts: true,
        loadSavedPosts: saved, loadMorePosts: more,
      })
      return <span>{state.feedSearchActive ? 'search' : 'feed'}|{state.feedInitialLoading ? 'loading' : 'ready'}</span>
    }
    const render = async (query = '', filter: 'all' | 'saved' | 'following' = 'all') => {
      await act(async () => root.render(<Probe query={query} filter={filter} />))
    }
    try { await run({ render, saved, more, followingMore }) }
    finally { await act(async () => root.unmount()); el.remove() }
  }

  it('warms saved posts after 350ms, without an early request', async () => {
    await withFeed(async ({ render, saved }) => {
      await render()
      expect(saved).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTime(349))
      expect(saved).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTime(1))
      expect(saved).toHaveBeenCalledWith()
    })
  })

  it('loads saved posts immediately when switching to the saved filter', async () => {
    await withFeed(async ({ render, saved }) => {
      await render('', 'saved')
      expect(saved).toHaveBeenCalledWith()
      expect(observer.current?.enabled).toBe(true)
      observer.current?.onLoadMore()
      expect(saved).toHaveBeenCalledWith(true)
    })
  })

  it('disables first-load warmup for search, and chooses search paging', async () => {
    await withFeed(async ({ render, saved, more, followingMore }) => {
      await render('keyword')
      await act(async () => vi.advanceTimersByTime(500))
      expect(saved).not.toHaveBeenCalled()
      expect(observer.current?.enabled).toBe(true)
      observer.current?.onLoadMore()
      expect(mockSearch.loadMore).toHaveBeenCalledTimes(1)
      expect(more).not.toHaveBeenCalled()
      expect(followingMore).not.toHaveBeenCalled()
    })
  })
})
