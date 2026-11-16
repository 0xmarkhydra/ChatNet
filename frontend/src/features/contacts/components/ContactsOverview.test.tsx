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
function setup() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onDirectory = vi.fn(), onInvitations = vi.fn(), onSettings = vi.fn()
  const actOnFriend = vi.fn(async () => {}), declineFriendRequest = vi.fn(async () => {})
  act(() => root.render(<ContactsOverview
    friends={[friend(1), friend(2)]}
    friendRequests={[friend(3, 'incoming'), friend(4, 'outgoing')]}
    suggestions={[suggestion(2), suggestion(5), suggestion(6)]}
    suggestionsLoading={false} suggestionsError={false}
    friendBusyIds={new Set()}
    actOnFriend={actOnFriend} declineFriendRequest={declineFriendRequest}
    onDirectory={onDirectory} onInvitations={onInvitations} onSettings={onSettings}
    connectionUrl="https://example.invalid/connect" onScanQr={() => {}}
  />))
  mounts.push(() => { act(() => root.unmount()); container.remove() })
  const click = (label: string) => {
    const button = [...container.querySelectorAll('button')].find(el => el.textContent?.includes(label))
    if (!button) throw new Error('Missing button: ' + label)
    act(() => button.click())
  }
  return { container, click, onDirectory, onInvitations, onSettings, actOnFriend, declineFriendRequest }
}
afterEach(() => { while (mounts.length) mounts.pop()!() })

describe('Friends overview', () => {
  it('uses live collection counts and excludes existing connections from suggestions', () => {
    const app = setup()
    expect(app.container.textContent).toContain('2Bạn bè')
    expect(app.container.textContent).toContain('1Lời mời đến')
    expect(app.container.textContent).toContain('2Gợi ý kết nối hiện có')
    expect(app.container.textContent).not.toContain('Gợi ý 2')
    expect(app.container.textContent).toContain('Gợi ý 5')
  })
  it('keeps invitation actions and route navigation wired to supplied handlers', () => {
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
})
