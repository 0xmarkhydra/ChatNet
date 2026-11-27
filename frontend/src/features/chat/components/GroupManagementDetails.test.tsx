// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupManagementDetails from './GroupManagementDetails'
import type { GroupManagementSection } from '../hooks/useGroupManagementDetails'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.restoreAllMocks()
})

function mount(request: (path: string, init?: RequestInit) => Promise<Response>, notify = vi.fn()) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  function render(id: number, section: GroupManagementSection, canEdit = true) {
    act(() => root.render(
      <GroupManagementDetails key={id + ':' + section}
        conversationId={id} section={section} canEdit={canEdit}
        request={request} notify={notify} />,
    ))
  }
  function button(label: string) {
    const item = [...host.querySelectorAll('button')].find(el => el.textContent?.includes(label))
    if (!item) throw new Error('Missing button: ' + label)
    return item
  }
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  return { host, render, button, notify }
}
const community = {
  id: 42, name: 'Nhóm', description: 'Mô tả', topic: 'Học tập', rules: 'Tôn trọng',
  visibility: 'private' as const, memberCount: 3,
}

describe('GroupManagementDetails data lifecycle', () => {
  it('discards a late response from the previous conversation', async () => {
    let completeOld!: (response: Response) => void
    const old = new Promise<Response>(resolve => { completeOld = resolve })
    const request = vi.fn(async (path: string) =>
      path.includes('/42/') ? old : Response.json({ ...community, id: 43, description: 'Nhóm mới' }),
    )
    const page = mount(request)
    page.render(42, 'details')
    page.render(43, 'details')
    await act(async () => { await Promise.resolve() })
    expect((page.host.querySelector('textarea[aria-label="Mô tả cộng đồng"]') as HTMLTextAreaElement).value).toBe('Nhóm mới')
    await act(async () => { completeOld(Response.json({ ...community, description: 'Dữ liệu cũ' })); await old })
    expect((page.host.querySelector('textarea[aria-label="Mô tả cộng đồng"]') as HTMLTextAreaElement).value).toBe('Nhóm mới')
  })

  it('saves edited notification preferences through the established endpoint', async () => {
    const request = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Response.json(JSON.parse(String(init.body)))
      return Response.json({ messageNotifications: true, mentionNotifications: true })
    })
    const page = mount(request)
    page.render(42, 'notifications')
    await act(async () => { await Promise.resolve() })
    const toggle = page.host.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(toggle).not.toBeNull()
    act(() => toggle.click())
    await act(async () => { page.button('Lưu cài đặt').click(); await Promise.resolve() })
    const mutation = request.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(mutation?.[0]).toBe('/api/conversations/42/notification-settings')
    expect(JSON.parse(String(mutation?.[1]?.body))).toEqual({ messageNotifications: false, mentionNotifications: true })
    expect(page.notify).toHaveBeenCalledWith('Đã cập nhật thông báo nhóm.')
  })

  it('does not expose community mutation controls to read-only members', async () => {
    const request = vi.fn(async () => Response.json(community))
    const page = mount(request)
    page.render(42, 'rules', false)
    await act(async () => { await Promise.resolve() })
    expect(page.host.textContent).toContain('Bạn có thể xem nội quy')
    expect([...page.host.querySelectorAll('button')].some(el => el.textContent?.includes('Lưu nội quy'))).toBe(false)
    expect((page.host.querySelector('textarea[aria-label="Nội quy cộng đồng"]') as HTMLTextAreaElement).disabled).toBe(true)
  })
})