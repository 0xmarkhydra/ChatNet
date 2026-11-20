// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import ProfilePage from './ProfilePage'

vi.mock('../../../shared/ui/UserAvatar', () => ({
  default: ({ username }: { username: string }) => <span data-avatar={username} />,
}))
vi.mock('./ProfileSidebar', () => ({ default: () => <aside>Profile details</aside> }))
vi.mock('./ProfileMediaGallery', () => ({ default: () => <div>Media gallery</div> }))

describe('own profile navigation and composer', () => {
  it('switches tabs, maintains a sliding indicator and opens the shared post prompt', async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previous = environment.IS_REACT_ACT_ENVIRONMENT
    environment.IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onCreatePost = vi.fn()
    try {
      await act(async () => root.render(<ProfilePage
        username="trung" displayName="Trung" coverSet={false} editBusy={false}
        friends={[]} posts={[]} pendingPost={null} postsBusy={false} postsError=""
        hasMorePosts={false} postCards={null} profileNote={null}
        onEditProfile={() => {}} onChangeAvatar={() => {}} onChangeCover={() => {}}
        onCreatePost={onCreatePost} onReloadPosts={() => {}} onLoadMorePosts={() => {}}
        onViewFriend={() => {}} onOpenContacts={() => {}} onOpenPost={() => {}}
      />))
      const tabbar = host.querySelector('.profile-page-tabbar')
      expect(tabbar?.querySelector('.profile-page-tab-indicator')).not.toBeNull()
      expect(tabbar?.classList.contains('is-measured')).toBe(true)
      expect(host.textContent).toContain('Trung ơi, bạn đang nghĩ gì?')
      const prompt = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('đang nghĩ gì'))
      await act(async () => prompt?.click())
      expect(onCreatePost).toHaveBeenCalledOnce()
      const media = host.querySelector<HTMLButtonElement>('#profile-page-tab-media')
      await act(async () => media?.click())
      expect(media?.getAttribute('aria-selected')).toBe('true')
      expect(host.textContent).toContain('Media gallery')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      environment.IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})
