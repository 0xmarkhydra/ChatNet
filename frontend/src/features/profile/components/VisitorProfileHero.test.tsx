// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import VisitorProfileHero from './VisitorProfileHero'

vi.mock('./ProfileNote', () => ({ default: () => null }))
vi.mock('../../../shared/ui/UserAvatar', () => ({
  default: ({ username, online }: { username: string; online?: boolean }) => <span data-online={online}>{username}</span>,
  profileAssetUrl: () => '/cover.jpg',
}))

describe('VisitorProfileHero actions', () => {
  it('keeps the real unfriend action accessible, and closes on outside click or Escape', async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previous = environment.IS_REACT_ACT_ENVIRONMENT
    environment.IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onRemoveFriendAction = vi.fn()
    try {
      const renderHero = (online: boolean) => act(async () => root.render(<VisitorProfileHero
        online={online}
        profile={{ id: 5, username: 'alice', displayName: 'Alice', avatarSet: false,
          coverSet: false, updatedAt: '2026-01-01', allowFriendRequests: true, online: false,
          bio: 'Bio only for owner', city: 'City only for owner',
          workplace: 'Company private', school: 'School private' }}
        relation="accepted" friendBusy={null} action="Bạn bè" request={async () => new Response()}
        onMessage={async () => {}} onFriendAction={() => {}} onRemoveFriendAction={onRemoveFriendAction}
      />))
      await renderHero(true)
      expect(host.querySelector('.profile-page-cover.has-default-cover')).not.toBeNull()
      expect(host.querySelector('.profile-page-hero-bottom .profile-page-hero-actions')).not.toBeNull()
      expect(host.querySelector('.profile-page-cover-action')).toBeNull()
      expect(host.querySelector('[data-online="true"]')).not.toBeNull()
      expect(host.textContent).toContain('Đang hoạt động')
      expect(host.textContent).not.toContain('Company private')
      expect(host.textContent).not.toContain('School private')
      expect(host.textContent).not.toContain('Bio only for owner')
      expect(host.textContent).not.toContain('City only for owner')
      await renderHero(false)
      expect(host.querySelector('[data-online="true"]')).toBeNull()
      expect(host.textContent).not.toContain('Đang hoạt động')
      const trigger = host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')
      expect(trigger).not.toBeNull()
      await act(async () => trigger?.click())
      expect(host.querySelector('[role="menu"]')).not.toBeNull()
      await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
      expect(host.querySelector('[role="menu"]')).toBeNull()
      await act(async () => trigger?.click())
      await act(async () => trigger?.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})))
      expect(host.querySelector('[role="menu"]')).toBeNull()
      expect(document.activeElement).toBe(trigger)
      await act(async () => trigger?.click())
      const remove = host.querySelector<HTMLButtonElement>('[role="menuitem"]')
      await act(async () => remove?.click())
      expect(onRemoveFriendAction).toHaveBeenCalledOnce()
      expect(host.querySelector('[aria-label="Tùy chọn trang cá nhân"]')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      host.remove()
      environment.IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})
