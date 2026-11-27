// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import ConversationActionDialog from './ConversationActionDialog'
import type { Conversation } from '../types'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it.each([null, { x: 20, y: 30 }])('offers pin, notification and category actions (%j)', async position => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const room = { id: 7, name: 'Nhóm', type: 'group', categoryId: 4, muted: true } as Conversation
  const togglePin = vi.fn(async () => {})
  const mute = vi.fn(async () => {})
  const assign = vi.fn(async () => true)
  const close = vi.fn()
  try {
    act(() => root.render(<ConversationActionDialog
      activeConversationAction={room} conversationMenuPosition={position} pinBusy={false}
      notificationBusy={false} categoryBusy={false} categories={[{ id: 4, name: 'Công việc', color: 'blue' }]}
      onAssignCategory={assign} onToggleNotifications={mute}
      setConversationActionId={close} toggleConversationPin={togglePin} />))
    const button = (name: string) => [...host.querySelectorAll('button')].find(item => item.textContent === name)!
    act(() => button('Bật thông báo').click())
    expect(mute).toHaveBeenCalledWith(room)
    act(() => button('Ghim cuộc trò chuyện').click())
    expect(togglePin).toHaveBeenCalledWith(room)
    act(() => button('Phân loại hội thoại').click())
    expect(button('Công việc').getAttribute('aria-pressed')).toBe('true')
    await act(async () => button('Chưa phân loại').click())
    expect(assign).toHaveBeenCalledWith(7, null)
    expect(close).toHaveBeenCalledWith(null)
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})
