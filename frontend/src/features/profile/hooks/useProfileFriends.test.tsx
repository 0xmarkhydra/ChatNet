// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { FriendConnection } from '../../contacts'
import ProfileFriendsPreview from '../components/ProfileFriendsPreview'
import { useProfileFriends } from './useProfileFriends'

const friend: FriendConnection = {
  id: 42,
  username: 'friend-42',
  displayName: 'Friend 42',
  online: false,
  status: 'accepted',
  updatedAt: '',
}

it('loads friends on cold mobile profile open without opening Contacts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const previousWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let resolveFriends!: (response: Response) => void
  const apiFetch = vi.fn(() => new Promise<Response>(resolve => { resolveFriends = resolve }))
  function ColdOpenProfile() {
    const data = useProfileFriends({ apiFetch, enabled: window.innerWidth < 768, initialFriends: [], sessionId: 'session-1' })
    return <ProfileFriendsPreview friends={data.friends} loading={data.loading} error={data.error}
      onRetry={() => void data.reload()} onViewFriend={vi.fn()} onViewAll={vi.fn()} />
  }

  try {
    await act(async () => root.render(<ColdOpenProfile />))
    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith('/api/friends', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    expect(host.querySelector('[role="status"][aria-busy="true"]')).not.toBeNull()

    await act(async () => resolveFriends(new Response(JSON.stringify([friend]), { status: 200 })))
    expect(host.textContent).toContain('Friend 42')
    expect(host.querySelector('[role="status"][aria-busy="true"]')).toBeNull()
    expect(host.querySelectorAll('li')).toHaveLength(1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth })
    vi.unstubAllGlobals()
  }
})
