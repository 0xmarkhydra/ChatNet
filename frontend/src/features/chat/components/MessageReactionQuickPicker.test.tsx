// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import MessageReactionQuickPicker from './MessageReactionQuickPicker'
import type { Message } from '../types'

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

it('keeps only one reaction strip and opens the full emoji catalog once', () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const toggleReaction = vi.fn(async (_message: Message, _emoji: string) => {})
  const openMessageReactions = vi.fn()
  const messages = [1,2].map(id => ({id, conversationId: 1, senderId: 3, text:'Xin chào', reactions:[], attachments:[], createdAt:'2026-11-27T01:00:00Z'} as Message))
  try {
    act(() => root.render(<>{messages.map(message => <MessageReactionQuickPicker key={message.id} message={message} busy={false} toggleReaction={toggleReaction} openMessageReactions={openMessageReactions}/>)}</>))
    const buttons = host.querySelectorAll<HTMLButtonElement>('.reaction-add')
    act(() => buttons[0].click())
    expect(document.querySelectorAll('.chat-quick-reaction-picker')).toHaveLength(1)
    act(() => buttons[1].click())
    expect(document.querySelectorAll('.chat-quick-reaction-picker')).toHaveLength(1)
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
    act(() => document.querySelector<HTMLButtonElement>('.chat-quick-reaction-picker [aria-label="Thêm emoji khác"]')!.click())
    expect(document.querySelectorAll('.chat-quick-reaction-picker')).toHaveLength(0)
    expect(openMessageReactions).toHaveBeenCalledExactlyOnceWith(messages[1])
    act(() => buttons[0].click())
    act(() => document.querySelector<HTMLButtonElement>('.chat-quick-reaction-picker button')!.click())
    expect(document.querySelectorAll('.chat-quick-reaction-picker')).toHaveLength(0)
    expect(toggleReaction).toHaveBeenCalledTimes(1)
    expect(toggleReaction.mock.calls[0]?.[0]).toEqual(messages[0])
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})
