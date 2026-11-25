// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupActivityDialog } from './GroupActivities'
import type { GroupActivity } from '../types/groupActivities'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.restoreAllMocks()
})

const poll: GroupActivity = {
  id: 8, kind: 'poll', title: 'Bình chọn', body: 'Đi đâu?',
  options: ['Hà Nội', 'Đà Nẵng'], counts: [2, 1], myVote: null,
  creatorName: 'Người tạo', createdAt: '2026-11-23T08:00:00Z',
}

function mount(kind: 'poll' | 'note' | 'reminder' | null, activity: GroupActivity | null = null) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onCreate = vi.fn(async () => {})
  const onVote = vi.fn(async () => {})
  const onTogglePin = vi.fn(async () => {})
  const onClose = vi.fn()
  act(() => root.render(<GroupActivityDialog kind={kind} activity={activity}
    onClose={onClose} onCreate={onCreate} onVote={onVote} onTogglePin={onTogglePin} />))
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  const click = (label: string) => {
    const el = [...host.querySelectorAll('button')].find(button =>
      (button.getAttribute('aria-label') ?? button.textContent?.trim())?.includes(label))
    if (!el) throw new Error('Missing button: ' + label)
    act(() => el.click())
  }
  return { host, click, onCreate, onVote, onTogglePin, onClose }
}

describe('GroupActivityDialog lifecycle', () => {
  it('validates poll options before posting and keeps mutation untouched on invalid submit', async () => {
    const page = mount('poll')
    await act(async () => { page.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(page.host.textContent).toContain('ít nhất hai lựa chọn hợp lệ')
    expect(page.onCreate).not.toHaveBeenCalled()
  })

  it('submits a non-empty note with pin choice and closes on success', async () => {
    const page = mount('note')
    const textarea = page.host.querySelector('textarea') as HTMLTextAreaElement
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
    act(() => { descriptor.set!.call(textarea, '   Ghi chú nhóm   '); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    // React handles delegated change events using the native input setter.
    const checkbox = page.host.querySelector('input[type="checkbox"]') as HTMLInputElement
    act(() => checkbox.click())
    await act(async () => { page.click('Tạo mới'); await Promise.resolve() })
    expect(page.onCreate).toHaveBeenCalledWith({
      kind: 'note', title: 'Ghi chú', body: 'Ghi chú nhóm', options: [], pin: true,
    })
    expect(page.onClose).toHaveBeenCalledOnce()
  })

  it('votes for the selected option without changing the poll payload', async () => {
    const page = mount(null, poll)
    const radios = [...page.host.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    act(() => radios[1].click())
    await act(async () => { page.click('Gửi bình chọn'); await Promise.resolve() })
    expect(page.onVote).toHaveBeenCalledWith(8, 1)
  })

  it('toggles pin on an existing activity and Escape closes the dialog', async () => {
    const page = mount(null, poll)
    await act(async () => { page.click('Ghim lên đầu cuộc trò chuyện'); await Promise.resolve() })
    expect(page.onTogglePin).toHaveBeenCalledWith(8, true)
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(page.onClose).toHaveBeenCalled()
  })
})
