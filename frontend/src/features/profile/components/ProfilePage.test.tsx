// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import ProfilePage from './ProfilePage'

vi.mock('../../../shared/ui/UserAvatar', () => ({
  default: ({ username, initialsOnly }: { username: string; initialsOnly?: boolean }) => <span data-avatar={username} data-initials-only={initialsOnly} />,
}))
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
    const onCreateStory = vi.fn()
    const onChangeAvatar = vi.fn()
    try {
      await act(async () => root.render(<ProfilePage
        username="trung" displayName="Trung" coverSet={false} avatarSet={false} editBusy={false}
        friends={[]} posts={[]} pendingPost={null} postsBusy={false} postsError=""
        hasMorePosts={false} postCards={null} profileNote={null}
        highlights={<section aria-label="Tin nổi bật" />}
        onEditProfile={() => {}} onChangeAvatar={onChangeAvatar} onChangeCover={() => {}}
        onCreatePost={onCreatePost} onCreateMediaPost={() => {}} onCreateStory={onCreateStory} onCheckIn={() => {}}
        onReloadPosts={() => {}} onLoadMorePosts={() => {}}
        onViewFriend={() => {}} onOpenContacts={() => {}} onOpenPost={() => {}}
      />))
      const identityRow = host.querySelector('.profile-page-hero-bottom')
      expect(identityRow?.querySelector('.profile-page-avatar-wrap')).not.toBeNull()
      expect(identityRow?.querySelector('.profile-page-identity-text')).not.toBeNull()
      expect(identityRow?.querySelector('.profile-page-hero-actions')).not.toBeNull()
      const info = host.querySelector('.profile-page-about')
      expect(info?.querySelector('h2')?.textContent).toBe('Thông tin cá nhân')
      expect(info?.nextElementSibling?.getAttribute('aria-label')).toBe('Tin nổi bật')
      expect(host.querySelector('.profile-page-main [aria-label="Tin nổi bật"]')).toBeNull()
      const story = [...host.querySelectorAll('button')].find(button => button.textContent === 'Thêm vào tin')
      await act(async () => story?.click())
      expect(onCreateStory).toHaveBeenCalledOnce()

      const avatar = host.querySelector<HTMLButtonElement>('button[aria-label="Tùy chọn ảnh đại diện"]')
      async function openAvatarMenu() {
        await act(async () => {
          avatar?.focus()
          avatar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        })
        return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      }
      const choices = await openAvatarMenu()
      expect(choices.map(item => item.textContent)).toEqual(['Xem ảnh đại diện', 'Đổi ảnh đại diện'])
      await act(async () => choices[0]?.click())
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Bạn chưa có ảnh đại diện.')
      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng hộp thoại"]')?.click())
      await vi.waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeNull()
        expect(document.activeElement).toBe(avatar)
      })
      const previewAgain = await openAvatarMenu()
      await act(async () => previewAgain[0]?.click())
      const preview = document.querySelector('[role="dialog"]')
      expect(preview?.querySelector('[data-initials-only="true"]')).not.toBeNull()
      const addPhoto = [...(preview?.querySelectorAll('button') ?? [])].find(button => button.textContent?.includes('Thêm ảnh đại diện'))
      expect(addPhoto).toBeDefined()
      await act(async () => addPhoto?.click())
      await vi.waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeNull()
        expect(onChangeAvatar).toHaveBeenCalledWith(avatar)
      })
      const reopened = await openAvatarMenu()
      expect(reopened[1]?.textContent).toBe('Đổi ảnh đại diện')
      await act(async () => reopened[1]?.click())
      expect(onChangeAvatar).toHaveBeenCalledTimes(2)
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
      const media = host.querySelector<HTMLButtonElement>('#profile-page-tab-image')
      await act(async () => media?.click())
      expect(media?.getAttribute('aria-selected')).toBe('true')
      expect(host.textContent).toContain('Media gallery')
      const video = host.querySelector<HTMLButtonElement>('#profile-page-tab-video')
      await act(async () => video?.click())
      expect(video?.getAttribute('aria-selected')).toBe('true')
      expect(media?.getAttribute('aria-selected')).toBe('false')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      environment.IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})