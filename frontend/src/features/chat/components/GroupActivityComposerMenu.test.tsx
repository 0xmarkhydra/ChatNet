// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupActivityComposerMenu } from './GroupActivities'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.restoreAllMocks()
})

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onCreate = vi.fn()
  act(() => root.render(<GroupActivityComposerMenu onCreate={onCreate} />))
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  const trigger = host.querySelector('button')!
  const open = () => act(() => trigger.click())
  const menu = () => document.querySelector('[role="menu"][aria-label="Tạo hoạt động nhóm"]')
  const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  return { open, trigger, menu, escape, onCreate }
}

describe('GroupActivityComposerMenu lifecycle', () => {
  it('opens the portal and emits the chosen activity before closing', () => {
    const page = mount()
    page.open()
    expect(page.menu()).not.toBeNull()
    expect(page.trigger.getAttribute('aria-expanded')).toBe('true')
    const note = [...document.querySelectorAll('[role="menuitem"]')].find(el => el.textContent?.includes('Ghi chú')) as HTMLButtonElement
    act(() => note.click())
    expect(page.onCreate).toHaveBeenCalledWith('note')
    expect(page.menu()).toBeNull()
  })

  it('dismisses an open menu with Escape without submitting an activity', () => {
    const page = mount()
    page.open()
    page.escape()
    expect(page.menu()).toBeNull()
    expect(page.onCreate).not.toHaveBeenCalled()
    expect(page.trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
