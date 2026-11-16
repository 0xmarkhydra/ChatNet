// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FriendConnection, FriendSearchResult } from '../types'
import ContactsOverview from './ContactsOverview'

vi.mock('./ContactQrPanel', () => ({ default: () => <div data-testid="qr-panel">QR</div> }))
const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
globals.IS_REACT_ACT_ENVIRONMENT = true

const friend = (id: number, direction?: 'incoming' | 'outgoing'): FriendConnection => ({
  id, username: 'user' + id, displayName: 'Người dùng ' + id,
  online: true, updatedAt: '2026-11-16T00:00:00Z',
  status: direction ? 'pending' : 'accepted', direction,
})
const suggestion = (id: number): FriendSearchResult => ({
  id, username: 'candidate' + id, displayName: 'Gợi ý ' + id, online: true,
})
const mounts: Array<() => void> = []
type OverviewProps = Parameters<typeof ContactsOverview>[0]
function setup(overrides: Partial<OverviewProps> = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onDirectory = vi.fn(), onInvitations = vi.fn(), onSettings = vi.fn()
  const onRetryFriends = vi.fn(), onRetrySuggestions = vi.fn()
  const actOnFriend = vi.fn(async () => {}), declineFriendRequest = vi.fn(async () => {})
  const props: OverviewProps = {
    friends: [friend(1), friend(2)],
    friendRequests: [friend(3, 'incoming'), friend(4, 'outgoing')],
    suggestions: [suggestion(2), suggestion(5), suggestion(6), suggestion(7), suggestion(8)],
    suggestionsLoading: false, suggestionsError: false,
    friendsLoading: false, friendsError: '',
    onRetryFriends, onRetrySuggestions,
    friendBusyIds: new Set(),
    actOnFriend, declineFriendRequest,
    onDirectory, onInvitations, onSettings,
    connectionUrl: 'https://example.invalid/connect', onScanQr: vi.fn(),
    ...overrides,
  }
  const render = (next: Partial<OverviewProps> = {}) => {
    Object.assign(props, next)
    act(() => root.render(<ContactsOverview {...props} />))
  }
  render()
  mounts.push(() => { act(() => root.unmount()); container.remove() })
  const click = (label: string) => {
    const button = [...container.querySelectorAll('button')].find(el =>
      el.textContent?.includes(label) || el.getAttribute('aria-label')?.includes(label))
    if (!button) throw new Error('Missing button: ' + label)
    act(() => button.click())
  }
  return { container, render, click, onDirectory, onInvitations, onSettings, onRetryFriends, onRetrySuggestions, actOnFriend, declineFriendRequest }
}
afterEach(() => { while (mounts.length) mounts.pop()!() })

describe('Friends overview', () => {
  it('counts all eligible suggestions while only showing four cards; excludes existing connections', () => {
    const app = setup()
    expect(app.container.textContent).toContain('2Bạn bè')
    expect(app.container.textContent).toContain('1Lời mời đến')
    expect(app.container.textContent).toContain('4Gợi ý kết nối hiện có')
    expect(app.container.textContent).not.toContain('Gợi ý 2')
    expect(app.container.querySelectorAll('.co-suggestion:not(.co-skeleton-card)')).toHaveLength(4)
    expect(app.container.textContent).toContain('Gợi ý 5')
    expect(app.container.textContent).toContain('Gợi ý 8')
  })

  it('routes and sends actions through existing callbacks without local fake mutations', () => {
    const app = setup()
    app.click('Chấp nhận')
    expect(app.actOnFriend).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    app.click('Từ chối')
    expect(app.declineFriendRequest).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    app.click('Xem tất cả')
    expect(app.onInvitations).toHaveBeenCalledTimes(1)
    app.click('Tìm bạn mới')
    expect(app.onDirectory).toHaveBeenCalledTimes(1)
    app.click('Quản lý quyền riêng tư')
    expect(app.onSettings).toHaveBeenCalledTimes(1)
  })

  it('makes privacy shortcuts keyboard-accessible and routes to actual settings and invitations', () => {
    const app = setup()
    const actions = [...app.container.querySelectorAll<HTMLButtonElement>('.co-privacy-details button')]
    expect(actions).toHaveLength(2)
    expect(actions[0].textContent).toContain('Kiểm soát quyền riêng tư')
    expect(actions[1].textContent).toContain('Quản lý lời mời kết bạn')
    expect(actions.every(button => button.type === 'button')).toBe(true)
    act(() => { actions[0].focus(); actions[0].click() })
    expect(document.activeElement).toBe(actions[0])
    expect(app.onSettings).toHaveBeenCalledTimes(1)
    act(() => actions[1].click())
    expect(app.onInvitations).toHaveBeenCalledTimes(1)
  })

  it('shows loading instead of transient zero counts and prevents stale suggestion cards', () => {
    const app = setup({ friendsLoading: true, suggestionsLoading: true })
    expect(app.container.querySelector('[aria-label="Đang tải bạn bè và lời mời"]')).not.toBeNull()
    expect(app.container.querySelector('[aria-label="Đang tải gợi ý kết nối"]')).not.toBeNull()
    expect(app.container.querySelectorAll('.co-request')).toHaveLength(0)
    expect(app.container.querySelectorAll('.co-suggestion:not(.co-skeleton-card)')).toHaveLength(0)
    expect(app.container.textContent).not.toContain('0Bạn bè')
    app.render({ friendsLoading: false, suggestionsLoading: false })
    expect(app.container.querySelectorAll('.co-request')).toHaveLength(1)
    expect(app.container.querySelectorAll('.co-suggestion:not(.co-skeleton-card)')).toHaveLength(4)
  })

  it('exposes meaningful retry actions for connection and suggestion errors', () => {
    const app = setup({ friendsError: 'Network error', suggestionsError: true })
    expect(app.container.querySelectorAll('[role="alert"]')).toHaveLength(2)
    expect(app.container.querySelectorAll('.co-request')).toHaveLength(0)
    expect(app.container.textContent).toContain('Không thể cập nhật lời mời')
    expect(app.container.textContent).toContain('–Bạn bè')
    const retryButtons = [...app.container.querySelectorAll<HTMLButtonElement>('.co-feedback button')]
    expect(retryButtons).toHaveLength(2)
    act(() => { retryButtons[0].click(); retryButtons[1].click() })
    expect(app.onRetryFriends).toHaveBeenCalledTimes(1)
    expect(app.onRetrySuggestions).toHaveBeenCalledTimes(1)
    expect(app.container.querySelectorAll('.co-suggestion:not(.co-skeleton-card)')).toHaveLength(0)
  })

  it('disables busy invitation and suggestion actions with visible feedback', () => {
    const app = setup({ friendBusyIds: new Set([3, 5]) })
    expect(app.container.querySelector<HTMLButtonElement>('.co-request .co-primary')?.disabled).toBe(true)
    expect(app.container.querySelector<HTMLButtonElement>('.co-suggestion button')?.disabled).toBe(true)
    expect(app.container.textContent).toContain('Đang xử lý')
    expect(app.container.textContent).toContain('Đang gửi')
    expect(app.container.querySelector<HTMLButtonElement>('[aria-label="Kết bạn với Gợi ý 5"]')).not.toBeNull()
  })
})
