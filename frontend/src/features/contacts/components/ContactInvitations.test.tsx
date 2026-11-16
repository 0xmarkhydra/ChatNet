import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ContactInvitations from './ContactInvitations'
import type { FriendConnection } from '../types'

const friend = {
  id: 42,
  username: 'demo_friend',
  displayName: 'Người bạn thử nghiệm',
  direction: 'incoming',
  online: true,
} as FriendConnection

describe('ContactInvitations', () => {
  it('renders incoming requests and preserves supplied account link in QR panel', () => {
    const html = renderToStaticMarkup(
      <ContactInvitations
        friendRequests={[friend]}
        friendBusyIds={new Set<number>()}
        actOnFriend={vi.fn()}
        declineFriendRequest={vi.fn()}
        connectionUrl="https://example.com/connect/demo_friend"
        onScanQr={vi.fn()}
        onBack={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(html).toContain('Người bạn thử nghiệm')
    expect(html).toContain('Chấp nhận lời mời của Người bạn thử nghiệm')
    expect(html).toContain('role="tablist"')
    expect(html).toMatch(/aria-controls="[^"]+-tabpanel"/)
    expect(html).toMatch(/aria-labelledby="[^"]+-tab-incoming"/)
  })

  it('disables conflicting actions for an in-flight request', () => {
    const html = renderToStaticMarkup(
      <ContactInvitations
        friendRequests={[friend]}
        friendBusyIds={new Set([42])}
        actOnFriend={vi.fn()}
        declineFriendRequest={vi.fn()}
        connectionUrl=""
        onScanQr={vi.fn()}
        onBack={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(html).toMatch(/disabled=""[^>]*aria-label="Chấp nhận lời mời/)
    expect(html).toMatch(/disabled=""[^>]*aria-label="Từ chối lời mời/)
  })
})
