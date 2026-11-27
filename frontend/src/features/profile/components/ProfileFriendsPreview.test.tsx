// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { UiLocaleContext } from '@/shared/i18n/locale'
import type { FriendConnection } from '../../contacts'
import ProfileFriendsPreview from './ProfileFriendsPreview'

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
  const render = (friends: FriendConnection[]) => root.render(<UiLocaleContext.Provider value={{ locale: 'en' }}><ProfileFriendsPreview friends={friends} onViewFriend={onViewFriend} onViewAll={onViewAll} /></UiLocaleContext.Provider>)
  try {
    await act(async () => render([friend(1, { status: 'pending' }), friend(2, { blockedByMe: true })]))
    expect(host.textContent).toBe('')
    const firstFriend = friend(3)
    await act(async () => render([friend(1, { status: 'pending' }), friend(2, { blockedByOther: true }), firstFriend, ...[4, 5, 6, 7].map(id => friend(id))]))
    expect(host.querySelectorAll('li')).toHaveLength(4)
    expect(host.textContent).not.toContain(friend(7).displayName)
    const viewFriend = host.querySelector<HTMLButtonElement>('li button')!
    expect(viewFriend.getAttribute('aria-label')).toBe(`View ${firstFriend.displayName}'s profile`)
    await act(async () => viewFriend.click())
    await act(async () => host.querySelector<HTMLButtonElement>('header button')!.click())
    expect(onViewFriend).toHaveBeenCalledWith('user3')
    expect(onViewAll).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it('shows translated loading skeleton while mobile profile friends load', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<ProfileFriendsPreview friends={[]} loading onViewFriend={vi.fn()} onViewAll={vi.fn()} />))
    expect(host.querySelector('[role="status"][aria-busy="true"] [aria-hidden="true"]')).not.toBeNull()
    expect(host.querySelectorAll('[role="status"] li')).toHaveLength(4)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
