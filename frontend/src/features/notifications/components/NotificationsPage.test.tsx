// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FriendConnection } from '../../contacts'
import type { PostMentionNotification } from '../../feed'
import type { Session } from '../../../shared/types/session'
import { SessionContext } from '../../../shared/context/SessionContext'
import NotificationsPage from './NotificationsPage'
import { UiLocaleContext } from '../../../shared/i18n/locale'

const request: FriendConnection = {
  id: 7, username: 'friend', displayName: 'Friend', online: false,
  status: 'pending', direction: 'incoming', updatedAt: '2026-11-14T00:00:00Z',
}

describe('server-backed notification state', () => {
  it('keeps pending invitations unread until the server state changes, including account switches', async () => {
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
      expect(hint()).toContain('1 thông báo')

      sessionRef.current = sessions.B
      await act(async () => root.render(<Probe session={sessions.B} />))
      expect(hint()).toContain('1 thông báo')
      await act(async () => (host.querySelector('.np-notification-row') as HTMLButtonElement).click())
      expect(hint()).toContain('1 thông báo')

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

let motionSessionId = 'account-a'
const host = document.createElement('div')
const root = createRoot(host)
const noop = () => {}

function mention(id: number): PostMentionNotification {
  return { id, postId: id, author: 'linh', authorDisplayName: 'Linh', createdAt: `2026-11-${10 + id}` }
}

function render(mentions: PostMentionNotification[], search = '', locale = 'vi') {
  const session: Session = { token: 'test', sessionId: motionSessionId, user: { id: 1, email: 'test@example.com', username: 'linh', displayName: 'Linh' } }
  act(() => root.render(<UiLocaleContext.Provider value={{ locale }}><SessionContext.Provider value={{ session, sessionRef: { current: session } }}><NotificationsPage
    requests={[]} conversations={[]} mentions={mentions} search={search}
    busyFriendIds={new Set()} onReadMention={noop} onOpenMention={noop}
    onAccept={noop} onDecline={noop} onOpenConversation={noop}
    onOpenInvitations={noop} onOpenFriend={noop} onSettings={noop}
  /></SessionContext.Provider></UiLocaleContext.Provider>))
}

describe('live notification entry motion', () => {
  afterEach(() => {
    act(() => root.render(null))
    host.remove()
    motionSessionId = 'account-a'
    vi.unstubAllGlobals()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  })

  it('animates only new visible rows and ignores read, filter, search and account changes', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const animated = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animated })
    document.body.append(host)

    render([mention(1)])
    expect(animated).not.toHaveBeenCalled()
    render([mention(1), mention(2)])
    expect(animated).toHaveBeenCalledTimes(1)
    expect((animated.mock.contexts[0] as HTMLElement).dataset.notificationKey).toBe('mention:2')

    render([mention(1), { ...mention(2), readAt: '2026-11-13' }])
    expect(animated).toHaveBeenCalledTimes(1)

    const filter = host.querySelector<HTMLButtonElement>('button[role="tab"]:last-child')!
    act(() => filter.click())
    render([mention(1), mention(2)], 'không khớp')
    render([mention(1), mention(2), mention(3)], 'không khớp')
    render([mention(1), mention(2), mention(3)])
    expect(animated).toHaveBeenCalledTimes(1)

    motionSessionId = 'account-b'
    render([mention(4)])
    expect(animated).toHaveBeenCalledTimes(1)
  })

  it('localizes existing tagged-post notifications and preserves author names on language switch', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    const entries = [{ ...mention(1), authorDisplayName: 'Nguyễn An' }]
    for (const [locale, filter, subtitle, action] of [
      ['vi','Nhắc đến','đã gắn thẻ bạn trong một bài viết','Mở bài viết được gắn thẻ'],
      ['en','Mentions','tagged you in a post','Open tagged post'],
      ['zh','提及','在一篇帖子中标记了你','打开标记你的帖子'],
      ['ja','メンション','投稿であなたをタグ付けしました','タグ付けされた投稿を開く'],
      ['ko','언급','게시물에 나를 태그했습니다','태그된 게시물 열기'],
    ]) {
      render(entries, '', locale)
      expect(host.querySelector('button[role="tab"]:last-child')?.textContent).toBe(filter)
      expect(host.querySelector('.np-notification-copy strong')?.textContent).toBe('Nguyễn An')
      expect(host.querySelector('.np-notification-copy span')?.textContent).toBe(subtitle)
      expect(host.querySelector('.np-detail-person p')?.textContent).toBe(subtitle)
      expect(host.querySelector('.np-primary')?.textContent).toBe(action)
    }
    render(entries, 'tagged', 'en')
    expect(host.querySelectorAll('.np-notification-row')).toHaveLength(1)
  })

  it('leaves the new notification visible without animating under reduced motion', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    const animated = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animated })
    document.body.append(host)
    render([mention(1)])
    render([mention(1), mention(2)])
    expect(host.querySelector('[data-notification-key="mention:2"]')).not.toBeNull()
    expect(animated).not.toHaveBeenCalled()
  })
})