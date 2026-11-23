// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupInviteJoinDialog from './GroupInviteJoinDialog'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const unmounts: Array<() => void> = []
afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

const preview = {
  conversationId: 42, name: 'Nhóm thử', memberCount: 5,
  requireApproval: false, expiresAt: '2030-01-01T10:00:00Z',
  isMember: false, pending: false,
}

function mount(request: (path: string, init?: RequestInit) => Promise<Response>) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onJoined = vi.fn(async () => {})
  const notify = vi.fn()
  act(() => root.render(<GroupInviteJoinDialog request={request} onJoined={onJoined} notify={notify} />))
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  const button = (name: string) => {
    const el = [...host.querySelectorAll('button')].find(item => (item.getAttribute('aria-label') ?? item.textContent?.trim()) === name)
    if (!el) throw new Error('Button missing: ' + name)
    return el
  }
  return { host, button, notify, onJoined }
}

describe('group invite dialog lifecycle', () => {
  it('removes the invitation token from URL and joins the previewed group', async () => {
    window.history.replaceState(null, '', '/chat?groupInvite=private-test-token&foo=bar#section')
    const request = vi.fn(async (_path: string, init?: RequestInit) =>
      Response.json(init?.method === 'POST' ? { status: 'joined', conversationId: 42 } : preview),
    )
    const page = mount(request)
    await act(async () => { await Promise.resolve() })
    expect(window.location.search).toBe('?foo=bar')
    expect(window.location.hash).toBe('#section')
    expect(page.host.textContent).toContain('Nhóm thử')
    await act(async () => { page.button('Tham gia nhóm').click(); await Promise.resolve() })
    expect(request).toHaveBeenCalledWith('/api/group-invites/private-test-token/join', { method: 'POST' })
    expect(page.onJoined).toHaveBeenCalledWith(42)
    expect(page.host.querySelector('[role="dialog"]')).toBeNull()
  })

  it('does not display the result of a preview request after closing the dialog', async () => {
    window.history.replaceState(null, '', '/chat?groupInvite=another-private-token')
    let resolve!: (result: Response) => void
    const response = new Promise<Response>(r => { resolve = r })
    const request = vi.fn(async () => response)
    const page = mount(request)
    act(() => page.button('Đóng').click())
    await act(async () => { resolve(Response.json(preview)); await response })
    expect(page.host.querySelector('[role="dialog"]')).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('handles pending approval without triggering conversation navigation', async () => {
    window.history.replaceState(null, '', '/chat?groupInvite=approval-token')
    const request = vi.fn(async (_path: string, init?: RequestInit) =>
      Response.json(init?.method === 'POST' ? { status: 'pending' } : { ...preview, requireApproval: true }),
    )
    const page = mount(request)
    await act(async () => { await Promise.resolve() })
    await act(async () => { page.button('Gửi yêu cầu').click(); await Promise.resolve() })
    expect(page.onJoined).not.toHaveBeenCalled()
    expect(page.notify).toHaveBeenCalledWith('Đã gửi yêu cầu. Bạn sẽ tham gia khi quản trị viên phê duyệt.')
  })
})
