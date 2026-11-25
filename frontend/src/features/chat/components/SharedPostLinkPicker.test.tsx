// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SharedPostLinkPicker from './SharedPostLinkPicker'
import { sendSharedPostLink, SharedPostDeliveryError } from '../lib/sendSharedPostLink'

const sessionRef = { current: { sessionId: 'session-A' } }
vi.mock('../../../shared/context/SessionContext', () => ({
  useSession: () => ({ session: { sessionId: 'session-A', user: { id: 5 } }, sessionRef }),
}))
vi.mock('../hooks/useConversationListSearch', () => ({
  useConversationListSearch: () => ({
    active: false, items: [], loading: false, loadingMore: false,
    hasMore: false, error: '', retry: vi.fn(), loadMore: vi.fn(),
  }),
}))
vi.mock('../lib/sendSharedPostLink', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/sendSharedPostLink')>()
  return { ...actual, sendSharedPostLink: vi.fn() }
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const unmounts: Array<() => void> = []
const destination = {
  id: 8, name: 'Nhóm A', type: 'group' as const, memberCount: 2,
  unreadCount: 0, lastMessage: '', online: false, createdAt: '2026-11-23T12:00:00Z',
}
const other = { ...destination, id: 9, name: 'Nhóm B' }

afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  document.body.innerHTML = ''
  sessionRef.current.sessionId = 'session-A'
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

function mount() {
  vi.stubGlobal('crypto', { randomUUID: () => 'generated-client-id' })
  const originalShowModal = HTMLDialogElement.prototype.showModal
  const originalClose = HTMLDialogElement.prototype.close
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onSent = vi.fn()
  const onClose = vi.fn()
  const onOpenChat = vi.fn()
  act(() => root.render(
    <SharedPostLinkPicker url="https://example.test/post/42"
      conversations={[destination, other]} hasMore={false} loadingMore={false}
      onLoadMore={vi.fn()} request={vi.fn()} onClose={onClose}
      onOpenChat={onOpenChat} onSent={onSent} />,
  ))
  unmounts.push(() => {
    act(() => root.unmount())
    host.remove()
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
  })
  const button = (label: string) => {
    const found = [...host.querySelectorAll('button')].find(el => el.textContent?.trim() === label)
    if (!found) throw new Error('Button missing: ' + label)
    return found
  }
  return { host, button, onSent, onClose, onOpenChat }
}

describe('SharedPostLinkPicker lifecycle', () => {
  it('blocks double-submit while preserving one idempotency clientId', async () => {
    let resolveSend!: () => void
    const pending = new Promise<void>(resolve => { resolveSend = resolve })
    vi.mocked(sendSharedPostLink).mockImplementation(async () => pending)
    const page = mount()
    act(() => page.button('Nhóm A').click())
    act(() => { page.button('Gửi').click(); page.button('Gửi').click() })
    expect(sendSharedPostLink).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendSharedPostLink).mock.calls[0][0]).toMatchObject({
      destination, url: 'https://example.test/post/42', clientId: 'generated-client-id',
    })
    await act(async () => { resolveSend(); await pending })
    expect(page.onSent).toHaveBeenCalledWith('Nhóm A')
    expect(page.onClose).toHaveBeenCalledOnce()
  })

  it('ignores completion after session identity changes', async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    vi.mocked(sendSharedPostLink).mockImplementation(async () => pending)
    const page = mount()
    act(() => page.button('Nhóm A').click())
    act(() => page.button('Gửi').click())
    sessionRef.current.sessionId = 'session-B'
    await act(async () => { finish(); await pending })
    expect(page.onSent).not.toHaveBeenCalled()
    expect(page.onClose).not.toHaveBeenCalled()
  })

  it('directs encrypted ambiguous delivery to the existing chat instead of resending', async () => {
    vi.mocked(sendSharedPostLink).mockRejectedValue(
      new SharedPostDeliveryError('Cần mở hội thoại để kiểm tra.', true),
    )
    const page = mount()
    act(() => page.button('Nhóm A').click())
    await act(async () => { page.button('Gửi').click(); await Promise.resolve() })
    expect(page.host.textContent).toContain('Cần mở hội thoại để kiểm tra.')
    act(() => page.button('Mở hội thoại').click())
    expect(page.onOpenChat).toHaveBeenCalledWith(8)
    expect(sendSharedPostLink).toHaveBeenCalledTimes(1)
  })
})
