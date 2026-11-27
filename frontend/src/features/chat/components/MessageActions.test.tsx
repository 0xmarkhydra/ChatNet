// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MessageActions from './MessageActions'
import type { Message } from '../types'
import type { MessageActionsProps } from '../types/messageActions'

vi.mock('./ChatEmojiPicker', () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) =>
    <button type="button" onClick={() => onSelect('🦊')}>Chọn emoji đặc biệt</button>,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.clearAllMocks()
})

const message = (id: number, senderId = 5, deleted = false): Message => ({
  id, conversationId: 41, senderId, sender: senderId === 5 ? 'me' : 'other',
  text: 'Xin chào', attachments: [], deleted,
  createdAt: '2026-11-23T09:00:00Z',
})

function mount(mode: 'actions' | 'reactions' = 'actions', msg = message(11)) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const callbacks: MessageActionsProps = {
    mode,
    activeMessageAction: msg,
    userId: 5,
    isPinned: false,
    onForwardMessage: vi.fn(),
    toggleMessagePin: vi.fn(async () => {}),
    setMessageActionId: vi.fn(),
    toggleReaction: vi.fn(async () => {}),
    setReplyingTo: vi.fn(),
    copyTarget: { kind: 'text' },
    copyMessageContent: vi.fn(async () => {}),
    translateMessage: vi.fn(async () => {}),
    editOwnMessage: vi.fn(async () => {}),
    recallOwnMessage: vi.fn(async () => {}),
  }
  const render = (props: Partial<MessageActionsProps> = {}) =>
    act(() => root.render(<MessageActions {...callbacks} {...props} />))
  render()
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  const button = (label: string) => {
    const found = [...host.querySelectorAll('button')].find(item =>
      (item.getAttribute('aria-label') ?? item.textContent?.trim())?.includes(label))
    if (!found) throw new Error('Button missing: ' + label)
    return found as HTMLButtonElement
  }
  return { host, button, render, callbacks }
}

describe('MessageActions subcomponents', () => {
  it('closes before forwarding the selected message and keeps existing callback order', () => {
    const page = mount()
    act(() => page.button('Chuyển tiếp').click())
    expect(page.callbacks.setMessageActionId).toHaveBeenCalledWith(null)
    expect(page.callbacks.onForwardMessage).toHaveBeenCalledWith(page.callbacks.activeMessageAction)
    expect(vi.mocked(page.callbacks.setMessageActionId).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(page.callbacks.onForwardMessage).mock.invocationCallOrder[0])
  })

  it('keeps message ownership and deleted-message action permissions', () => {
    const page = mount('actions', message(11, 6, true))
    expect(page.host.textContent).toContain('Trả lời')
    expect(page.host.textContent).toContain('Dịch')
    expect(page.host.textContent).not.toContain('Chuyển tiếp')
    expect(page.host.textContent).not.toContain('Ghim tin nhắn')
    expect(page.host.textContent).not.toContain('Sửa')
    expect(page.host.textContent).not.toContain('Thu hồi')
  })

  it('resets expanded emoji picker when the active message changes', () => {
    const page = mount('reactions')
    act(() => page.button('Thêm emoji khác').click())
    expect(page.host.textContent).toContain('Chọn emoji đặc biệt')
    page.render({ activeMessageAction: message(12) })
    expect(page.host.textContent).not.toContain('Chọn emoji đặc biệt')
    expect(page.button('Thêm emoji khác').getAttribute('aria-expanded')).toBe('false')
  })

  it('uses the current message for a custom emoji reaction, then closes', () => {
    const page = mount('reactions', message(20))
    act(() => page.button('Thêm emoji khác').click())
    act(() => page.button('Chọn emoji đặc biệt').click())
    expect(page.callbacks.setMessageActionId).toHaveBeenCalledWith(null)
    expect(page.callbacks.toggleReaction).toHaveBeenCalledWith(page.callbacks.activeMessageAction, '🦊')
  })
  it('keeps copy action available with the original copy target', async () => {
    const page = mount()
    await act(async () => { page.button('Sao chép').click(); await Promise.resolve() })
    expect(page.callbacks.copyMessageContent).toHaveBeenCalledWith(page.callbacks.activeMessageAction, { kind: 'text' })
  })

  it('offers image downloads only for available, non-deleted attachments', () => {
    const photo = { ...message(11), attachments: [{ kind: 'image' as const, name: 'photo.jpg', storageRef: 'photo', contentType: 'image/jpeg', sizeBytes: 10, url: 'https://media.example/photo.jpg' }] }
    const page = mount('actions', photo)
    expect(page.button('Tải ảnh')).toBeTruthy()
    page.render({ activeMessageAction: { ...photo, deleted: true } })
    expect(page.host.querySelector('[aria-label="Tải ảnh"]')).toBeNull()
    page.render({ activeMessageAction: message(12) })
    expect(page.host.querySelector('[aria-label="Tải ảnh"]')).toBeNull()
  })

  it('routes replies to the original message and closes its action menu', () => {
    const page = mount()
    act(() => page.button('Trả lời').click())
    expect(page.callbacks.setReplyingTo).toHaveBeenCalledWith(page.callbacks.activeMessageAction)
    expect(page.callbacks.setMessageActionId).toHaveBeenCalledWith(null)
  })

})