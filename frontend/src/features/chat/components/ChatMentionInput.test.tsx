// @vitest-environment jsdom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ChatMentionInput from './ChatMentionInput'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

it('keeps the mention overlay text metrics and scrolling aligned with the caret', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const inputRef = createRef<HTMLTextAreaElement>()
  const props = {
    conversationId: 1,
    members: [],
    inputRef,
    text: 'Xin chào Việt Nam',
    setText: vi.fn(),
    placeholder: 'Nhập tin nhắn…',
    onFilesPaste: vi.fn(),
  }
  try {
    await act(async () => root.render(<ChatMentionInput {...props} />))
    const input = inputRef.current!
    const mirror = container.querySelector<HTMLDivElement>('.chat-mention-highlight')!
    expect(input).toBeTruthy()
    expect(mirror).toBeTruthy()

    input.style.fontSize = '17px'
    input.style.lineHeight = '27px'
    input.style.letterSpacing = '0.4px'
    input.style.padding = '11px 12px 13px 8px'
    Object.defineProperty(input, 'offsetWidth', { configurable: true, value: 250 })
    Object.defineProperty(input, 'clientWidth', { configurable: true, value: 238 })
    input.scrollTop = 20
    input.scrollLeft = 3

    await act(async () => root.render(
      <ChatMentionInput {...props} text={'Xin chào Việt Nam\n@all thử căn con trỏ'} />,
    ))

    expect(mirror.style.fontSize).toBe('17px')
    expect(mirror.style.lineHeight).toBe('27px')
    expect(mirror.style.letterSpacing).toBe('0.4px')
    expect(mirror.style.paddingTop).toBe('11px')
    expect(mirror.style.paddingBottom).toBe('13px')
    expect(mirror.style.paddingLeft).toBe('8px')
    expect(mirror.style.paddingRight).toBe('24px')
    expect(mirror.scrollTop).toBe(input.scrollTop)
    expect(mirror.scrollLeft).toBe(input.scrollLeft)
  } finally {
    await act(async () => root.unmount())
  }
})
