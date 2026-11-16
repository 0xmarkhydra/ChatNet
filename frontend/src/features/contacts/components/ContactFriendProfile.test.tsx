import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ContactFriendProfile from './ContactFriendProfile'
import type { FriendConnection } from '../types'

const friend = {
  id: 17, username: 'friend17', displayName: 'Bạn thử nghiệm', online: true,
  blockedByMe: true, blockedByOther: false,
} as FriendConnection

describe('ContactFriendProfile', () => {
  it('keeps blocked call disabled and labels chat action with friend name', () => {
    const html = renderToStaticMarkup(<ContactFriendProfile
      friend={friend}
      contactMetadata={{ 17: { nickname: 'Bạn thân', note: '', favorite: true } }}
      friendBusyIds={new Set([17])}
      friendMenuId={null}
      setFriendMenuId={vi.fn()}
      setFriendPreview={vi.fn()}
      changePersonalContact={vi.fn()}
      removeAcceptedFriend={vi.fn()}
      blockContact={vi.fn()}
      unblockContact={vi.fn()}
      reportContact={vi.fn()}
      openChat={vi.fn()}
      startCall={vi.fn()}
      isBlocked={() => true}
    />)
    expect(html).toContain('Bạn thân')
    expect(html).toContain('aria-label="Xem hội thoại với Bạn thử nghiệm"')
    expect(html).toMatch(/aria-label="Gọi thoại cho Bạn thử nghiệm"[^>]*disabled=""/)
    expect(html).toContain('aria-pressed="true"')
  })
})
