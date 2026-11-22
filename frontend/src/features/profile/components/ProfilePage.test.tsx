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
        onCreatePost={onCreatePost} onCreateMediaPost={() => {}} onCreateStory={() => {}} onCheckIn={() => {}}
        onReloadPosts={() => {}} onLoadMorePosts={() => {}}
        onViewFriend={() => {}} onOpenContacts={() => {}} onOpenPost={() => {}}
      />))
      const identityRow = host.querySelector('.profile-page-hero-bottom')
      expect(identityRow?.querySelector('.profile-page-avatar-wrap')).not.toBeNull()
      expect(identityRow?.querySelector('.profile-page-identity-text')).not.toBeNull()
      expect(identityRow?.querySelector('.profile-page-hero-actions')).not.toBeNull()
      const tabbar = host.querySelector('.profile-page-tabbar')
      expect(tabbar?.querySelector('.profile-page-tab-indicator')).not.toBeNull()
      expect(tabbar?.parentElement?.classList.contains('profile-page')).toBe(true)
      expect(host.querySelector('.profile-page-hero')?.contains(tabbar)).toBe(false)
      expect(tabbar?.classList.contains('is-measured')).toBe(true)
      expect(host.textContent).toContain('Bạn đang nghĩ gì?')
      expect(host.querySelectorAll('[aria-label="Tạo nội dung mới"]')).toHaveLength(1)
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
