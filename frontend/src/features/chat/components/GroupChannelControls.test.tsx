// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import GroupChannelControls from './GroupChannelControls'
import type { GroupChannel } from '../utils/groupChannels'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const unmounts: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

it('group notification button silences normal messages but preserves @Tag push', async () => {
  const request = vi.fn(async (_path: string, init?: RequestInit) => ({
    ok: true,
    json: async () => init?.method === 'PUT'
      ? JSON.parse(init.body as string)
      : { messageNotifications: true, mentionNotifications: true },
  }) as Response)
  const notify = vi.fn()
  const onGroupNotificationChanged = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  unmounts.push(async () => { await act(async () => root.unmount()) })
  await act(async () => root.render(
    <GroupChannelControls
      groupId={42} groupName="Nhóm thử nghiệm"
      channel={{ id: 0, name: 'Thảo luận chung' } as GroupChannel}
      userId={5} canEdit={false} canLeave={false} scope="group"
      request={request} notify={notify}
      onGroupRenamed={vi.fn()} onChannelsChanged={async () => {}}
      onChannelDeleted={async () => {}} onLeftGroup={vi.fn()}
      onGroupNotificationChanged={onGroupNotificationChanged}
    />,
  ))
  const button = [...host.querySelectorAll('button')].find(el => el.textContent?.includes('Tắt thông báo nhóm'))
  expect(button).toBeDefined()
  await act(async () => button?.click())
  expect(request).toHaveBeenCalledWith('/api/conversations/42/notification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageNotifications: false, mentionNotifications: true }),
  })
  expect(onGroupNotificationChanged).toHaveBeenCalledWith(true)
  expect(host.textContent).toContain('Bật thông báo nhóm')
  expect(notify).toHaveBeenCalledWith('Đã tắt thông báo nhóm.', 'success')
})
