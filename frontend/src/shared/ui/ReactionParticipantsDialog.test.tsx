// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ReactionParticipantsDialog from './ReactionParticipantsDialog'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

afterEach(() => {
  document.body.style.overflow = ''
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

it('locks background scrolling and restores the opener focus and prior overflow on close', async () => {
  const opener = document.createElement('button')
  const host = document.createElement('div')
  document.body.append(opener, host)
  opener.focus()
  document.body.style.overflow = 'auto'
  const root = createRoot(host)
  const onClose = vi.fn()
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ items: [], hasMore: false }) }) as Response)

  await act(async () => {
    root.render(<ReactionParticipantsDialog kind="post" id={12} request={request} onClose={onClose} />)
  })

  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  const close = dialog.querySelector('.reaction-users-close') as HTMLButtonElement
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.activeElement).toBe(close)

  await act(async () => {
    close.click()
  })
  expect(onClose).toHaveBeenCalledTimes(1)

  await act(async () => root.unmount())
  expect(document.body.style.overflow).toBe('auto')
  expect(document.activeElement).toBe(opener)
})

it('wraps Tab and Shift+Tab among controls without losing dialog focus', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ items: [], hasMore: false }) }) as Response)
  await act(async () => {
    root.render(<ReactionParticipantsDialog
      kind="message"
      id={42}
      reactions={[{ emoji: '❤️', count: 1 }]}
      request={request}
      onClose={vi.fn()}
    />)
  })
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  buttons[buttons.length - 1].focus()
  buttons[buttons.length - 1].dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', bubbles: true, cancelable: true,
  }))
  expect(document.activeElement).toBe(buttons[0])
  buttons[0].dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
  }))
  expect(document.activeElement).toBe(buttons[buttons.length - 1])
  await act(async () => root.unmount())
})

it('announces loading as busy while keeping the list available to screen readers', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(() => new Promise<Response>(() => {}))
  await act(async () => {
    root.render(<ReactionParticipantsDialog kind="post" id={21} request={request} onClose={vi.fn()} />)
  })
  const list = document.querySelector('.reaction-users-list') as HTMLElement
  expect(list.getAttribute('aria-live')).toBe('polite')
  expect(list.getAttribute('aria-busy')).toBe('true')
  expect(list.textContent).toContain('Đang tải danh sách')
  await act(async () => root.unmount())
})
