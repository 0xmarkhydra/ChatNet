// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import VisitorProfile from './VisitorProfile'
import { loadVisitorPosts, loadVisitorProfile } from '../api/profile'

vi.mock('../api/profile', () => ({
  loadVisitorProfile: vi.fn(),
  loadVisitorPosts: vi.fn(),
  reactToVisitorPost: vi.fn(),
}))
vi.mock('./VisitorProfileHero', () => ({ default: ({ profile }: { profile: { username: string } }) => <div>Hồ sơ @{profile.username}</div> }))
vi.mock('../../feed/components/FeedPostCard', () => ({ default: ({ post }: { post: { id: number } }) => <div>Bài {post.id}</div> }))

describe('VisitorProfile session isolation', () => {
  it('hides the old profile synchronously on username change and ignores late requests', async () => {
    const globalAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previousAct = globalAct.IS_REACT_ACT_ENVIRONMENT
    globalAct.IS_REACT_ACT_ENVIRONMENT = true
    const element = document.createElement('div')
    document.body.append(element)
    const root = createRoot(element)
    const profilePending = new Map<string, (value: Response) => void>()
    vi.mocked(loadVisitorProfile).mockImplementation(async (_request, username) =>
      new Promise<Response>(resolve => { profilePending.set(username, resolve) }))
    vi.mocked(loadVisitorPosts).mockResolvedValue(new Response('[]'))
    const props = {
      request: async () => new Response('[]'),
      currentUser: 'me',
      token: 'session',
      targetLanguage: 'vi',
      relationship: () => 'none',
      friendBusy: null,
      onFriend: async () => {},
      onMessage: async () => {},
      onClose: () => {},
      onPostOpen: () => {},
      onReactionUsers: () => {},
      onUpdated: () => {},
      updates: [] as [],
      onDeleted: () => {},
      feedback: () => {},
    } as const
    try {
      await act(async () => root.render(<VisitorProfile {...props} username="alice" />))
      await act(async () => profilePending.get('alice')?.(new Response(JSON.stringify({ id: 1, username: 'alice' }))))
      expect(element.textContent).toContain('Hồ sơ @alice')
      await act(async () => root.render(<VisitorProfile {...props} username="bob" />))
      expect(element.textContent).not.toContain('Hồ sơ @alice')
      expect(element.textContent).not.toContain('Hồ sơ @bob')
      await act(async () => profilePending.get('bob')?.(new Response(JSON.stringify({ id: 2, username: 'bob' }))))
      expect(element.textContent).toContain('Hồ sơ @bob')
    } finally {
      await act(async () => root.unmount())
      element.remove()
      globalAct.IS_REACT_ACT_ENVIRONMENT = previousAct
      vi.clearAllMocks()
    }
  })
})
