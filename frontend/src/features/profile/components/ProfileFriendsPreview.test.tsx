// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { FriendConnection } from '../../contacts'
import ProfileFriendsPreview from './ProfileFriendsPreview'

vi.mock('@/shared/ui/avatarStoryStatus', () => ({ useAvatarStoryStatus: () => 'unseen' }))

const friend = (id: number, fields: Partial<FriendConnection> = {}): FriendConnection => ({
  id, username: 'user' + id, displayName: 'Bạn ' + id, online: false, status: 'accepted', updatedAt: '', ...fields,
})

it('hides empty or unavailable connections and navigates from the four accepted previews', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onViewFriend = vi.fn()
  const onViewAll = vi.fn()
  const render = (friends: FriendConnection[]) => root.render(<ProfileFriendsPreview friends={friends} onViewFriend={onViewFriend} onViewAll={onViewAll} />)
  try {
    await act(async () => render([friend(1, { status: 'pending' }), friend(2, { blockedByMe: true })]))
    expect(host.textContent).toBe('')
    await act(async () => render([friend(1, { status: 'pending' }), friend(2, { blockedByOther: true }), ...[3, 4, 5, 6, 7].map(id => friend(id))]))
    expect(host.querySelectorAll('li')).toHaveLength(4)
    expect(host.querySelectorAll('[data-story-status="none"]')).toHaveLength(4)
    expect(host.querySelector('[data-slot="avatar-story-ring"]')).toBeNull()
    expect(host.textContent).not.toContain('Bạn 7')
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem hồ sơ Bạn 3"]')!.click())
    await act(async () => host.querySelector<HTMLButtonElement>('header button')!.click())
    expect(onViewFriend).toHaveBeenCalledWith('user3')
    expect(onViewAll).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})