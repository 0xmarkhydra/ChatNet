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
vi.mock('./VisitorProfileHero', () => ({ default: ({ profile, tabs, onTabChange }: { profile: { username: string }; tabs: {id:string;label:string}[]; onTabChange:(tab:string)=>void }) => <div>Hồ sơ @{profile.username}<nav>{tabs.map(tab=><button type="button" key={tab.id} onClick={()=>onTabChange(tab.id)}>{tab.label}</button>)}</nav></div> }))
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
      onRemoveFriend: async () => {},
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
describe('VisitorProfile data-driven sections', () => {
  it('hides missing tabs and only shows media from loaded posts', async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previous = environment.IS_REACT_ACT_ENVIRONMENT
    environment.IS_REACT_ACT_ENVIRONMENT = true
    const element = document.createElement('div')
    document.body.append(element)
    const root = createRoot(element)
    const props = {
      username: 'alice', request: async () => new Response('[]'), currentUser: 'me', token: 'session',
      targetLanguage: 'vi', relationship: () => 'none', friendBusy: null,
      onFriend: async () => {}, onRemoveFriend: async () => {}, onMessage: async () => {},
      onClose: () => {}, onPostOpen: vi.fn(), onReactionUsers: () => {},
      onUpdated: () => {}, updates: [] as [], onDeleted: () => {}, feedback: () => {},
    }
    try {
      vi.mocked(loadVisitorProfile).mockResolvedValue(new Response(JSON.stringify({
        id: 1, username: 'alice', displayName: 'Alice', allowFriendRequests: true,
        avatarSet: false, coverSet: false, updatedAt: '2026-01-01',
      })))
      vi.mocked(loadVisitorPosts).mockResolvedValue(new Response('[]'))
      await act(async () => root.render(<VisitorProfile {...props} />))
      expect(element.textContent).toContain('Bài viết')
      expect(element.textContent).not.toContain('Ảnh & video')
      expect(element.textContent).not.toContain('Giới thiệu')
      expect(element.textContent).not.toContain('Bạn chung')
      expect(element.textContent).not.toContain('Khoảnh khắc nổi bật')
      expect(element.querySelector('[aria-label="Tùy chọn trang cá nhân"]')).toBeNull()

      vi.mocked(loadVisitorProfile).mockResolvedValue(new Response(JSON.stringify({
        id: 1, username: 'alice', displayName: 'Alice', city: 'Hà Nội', allowFriendRequests: true,
        avatarSet: false, coverSet: false, updatedAt: '2026-01-01',
      })))
      vi.mocked(loadVisitorPosts).mockResolvedValue(new Response(JSON.stringify([{
        id: 4, author: 'alice', content: 'Ảnh', comments: [], liked: false, likes: 0,
        createdAt: '2026-01-01', attachments: [{
          kind: 'image', storageRef: 'image-1', name: 'Ảnh thật', sizeBytes: 20,
          contentType: 'image/jpeg', url: '/media/real.jpg',
        }],
      }])))
      await act(async () => root.render(<VisitorProfile {...props} token="new-session" />))
      expect(element.textContent).toContain('Ảnh & video')
      expect(element.textContent).toContain('Giới thiệu')
      const tab = [...element.querySelectorAll('button')].find(button => button.textContent === 'Ảnh & video')
      await act(async () => tab?.click())
      expect(element.querySelector('.visitor-media-grid img')?.getAttribute('src')).toBe('/media/real.jpg')
    } finally {
      await act(async () => root.unmount())
      element.remove()
      environment.IS_REACT_ACT_ENVIRONMENT = previous
      vi.clearAllMocks()
    }
  })
})
