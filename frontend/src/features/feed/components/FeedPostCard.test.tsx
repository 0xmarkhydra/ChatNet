// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedPostIdFromPath, feedPostPath } from '../../../shared/utils/feedPostPath'
import type { Session } from '../../../shared/types/session'
import type { Post } from '../types'
import FeedPostCard from './FeedPostCard'
import { usePostRouteLoad } from '../hooks/usePostRouteLoad'

const original: Post = {
  id: 12, author: 'linh', content: 'Bài gốc', likes: 0, liked: false, comments: [],
  createdAt: '', visibility: 'public',
}
const quickRepost: Post = {
  ...original, id: 60, content: '', repostKind: 'quick', originalPost: original,
}
const viewer: Session = {
  token: 'test', sessionId: 'viewer',
  user: { id: 1, email: 'viewer@example.invalid', username: 'viewer', displayName: 'Viewer' },
}

describe('quick repost card actions', () => {
  let host: HTMLDivElement
  let root: Root
  const setActivePostId = vi.fn()
  function RouteHarness() {
    const location = useLocation()
    const navigate = useNavigate()
    const sessionRef = useRef(viewer)
    const [posts, setPosts] = useState<Post[]>([])
    const request = vi.fn(async (path: string) => {
      const id = Number(path.split('/').at(-1))
      return Response.json(id === quickRepost.id ? quickRepost : original)
    })
    const routedPost = usePostRouteLoad({
      sessionId: viewer.sessionId, sessionToken: viewer.token, sessionRef,
      tab: 'feed', routeSearch: location.search,
      routePostId: feedPostIdFromPath(location.pathname),
      request, setTab: vi.fn(), setPosts, onError: vi.fn(),
    })
    return <>
      <output data-testid="route">{location.pathname}</output>
      <output data-testid="loaded-post">{routedPost?.id ?? ''}</output>
      <FeedPostCard post={quickRepost} name="viewer" apiFetch={vi.fn()}
        syncFeedPost={vi.fn()} removeFeedPost={vi.fn()} setNotice={vi.fn()} token="test"
        translationPreferencesLoaded targetLanguage="en" setActivePostId={setActivePostId}
        onOpenOriginal={(id) => navigate(feedPostPath(id))}
        likePreviews={{}} like={vi.fn(async () => undefined)} onReactionUsers={vi.fn()} />
    </>
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    setActivePostId.mockClear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it.each(['/feed', '/feed/posts/60'])('routes comment action to original from %s when original is absent from loaded feed', async (initialRoute) => {
    act(() => root.render(<MemoryRouter initialEntries={[initialRoute]}><RouteHarness /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    const commentButton = host.querySelector<HTMLButtonElement>('.post-detail-trigger')
    expect(commentButton).not.toBeNull()
    expect(commentButton?.hasAttribute('aria-expanded')).toBe(false)
    expect(host.querySelector('.feed-post-like')).toBeNull()
    expect(host.querySelector('.feed-post-toolbar .feed-repost-action')).not.toBeNull()

    await act(async () => {
      commentButton?.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(host.querySelector('[data-testid="route"]')?.textContent).toBe(feedPostPath(original.id))
    expect(host.querySelector('[data-testid="loaded-post"]')?.textContent).toBe(String(original.id))
    expect(setActivePostId).not.toHaveBeenCalled()
  })
})
