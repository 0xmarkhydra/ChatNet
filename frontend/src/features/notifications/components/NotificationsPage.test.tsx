// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { FriendConnection } from '../../contacts'
import type { Session } from '../../../shared/types/session'
import { SessionContext } from '../../../shared/context/SessionContext'
import NotificationsPage from './NotificationsPage'

const request: FriendConnection = {
  id: 7, username: 'friend', displayName: 'Friend', online: false,
  status: 'pending', direction: 'incoming', updatedAt: '2026-11-14T00:00:00Z',
}

describe('notification local read state isolation', () => {
  it('does not carry local read state across account changes, including A → B → A', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const user = (sessionId: string): Session => ({
      token: 'test', sessionId,
      user: { id: sessionId === 'A' ? 1 : 2, email: 'test@example.com', username: sessionId, displayName: sessionId },
    })
    const sessions = { A: user('A'), B: user('B') }
    const sessionRef = { current: sessions.A as Session | null }
    const noop = vi.fn()
    function Probe({ session }: { session: Session }) {
      return <SessionContext.Provider value={{ session, sessionRef }}>
        <NotificationsPage
          requests={[request]} conversations={[]} mentions={[]} search=""
          busyFriendIds={new Set()}
          onReadMention={noop} onOpenMention={noop} onAccept={noop} onDecline={noop}
          onOpenConversation={noop} onOpenInvitations={noop} onOpenFriend={noop} onSettings={noop}
        />
      </SessionContext.Provider>
    }
    const hint = () => host.querySelector('.np-unread-hint')?.textContent ?? null
    try {
      await act(async () => root.render(<Probe session={sessions.A} />))
      expect(hint()).toContain('1 thông báo')
      await act(async () => (host.querySelector('.np-notification-row') as HTMLButtonElement).click())
      expect(hint()).toBe(null)

      sessionRef.current = sessions.B
      await act(async () => root.render(<Probe session={sessions.B} />))
      expect(hint()).toContain('1 thông báo')
      await act(async () => (host.querySelector('.np-notification-row') as HTMLButtonElement).click())
      expect(hint()).toBe(null)

      sessionRef.current = sessions.A
      await act(async () => root.render(<Probe session={sessions.A} />))
      expect(hint()).toContain('1 thông báo')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
