// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from './AppSidebar'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })

const roots: Array<{ unmount: () => void; element: HTMLElement }> = []

function renderSidebar(tab: 'feed' | 'notifications' | 'profile' = 'feed', settingsActive = false, feedSaved = false, screenshot?: { onScreenshot: () => void; screenshotBusy?: boolean }) {
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  roots.push({ unmount: () => root.unmount(), element })
  const onNavigate = vi.fn()
  const onSettings = vi.fn()
  const onSaved = vi.fn()
  const noop = () => {}
  act(() => root.render(
    <AppSidebar
      tab={tab} section={null} username="user" displayName="User"
      unreadTotal={2} notificationCount={3} feedSaved={feedSaved}
      settingsActive={settingsActive} onNavigate={onNavigate}
      onSettings={onSettings} onSaved={onSaved}
      onNewPost={noop} onNewDirect={noop} onNewGroup={noop}
      onAddFriend={noop} onSell={noop} onSearch={noop}
      {...screenshot}
    />,
  ))
  const button = (label: string) => {
    const found = Array.from(element.querySelectorAll('button')).find(node => node.getAttribute('aria-label') === label)
    if (!found) throw new Error(`Missing sidebar button: ${label}`)
    return found
  }
  return { element, button, onNavigate, onSettings, onSaved }
}

afterEach(() => {
  while (roots.length) {
    const entry = roots.pop()!
    act(() => entry.unmount())
    entry.element.remove()
  }
  vi.clearAllMocks()
})

describe('AppSidebar v2 navigation', () => {
  it('provides five primary routes and a separate notification link', () => {
    const { button, onNavigate, element } = renderSidebar('notifications')
    for (const label of ['Bảng tin', 'Tin nhắn', 'Khám phá', 'Danh bạ', 'Marketplace']) {
      expect(element.querySelector('nav[aria-label="Các khu vực"]')?.contains(button(label))).toBe(true)
    }
    expect(button('Thông báo').getAttribute('aria-current')).toBe('page')
    expect(button('Thông báo').textContent).toContain('3')
    act(() => button('Bảng tin').click())
    expect(onNavigate).toHaveBeenCalledWith('feed')
  })

  it('keeps saved and settings in account dropdown rather than main utilities', () => {
    const { button, element } = renderSidebar('profile', true, true)
    const utility = element.querySelector('[role="group"][aria-label="Tiện ích"]')
    expect(utility?.querySelectorAll('button')).toHaveLength(1)
    expect(button('Menu tài khoản').getAttribute('aria-haspopup')).toBe('menu')
    expect(button('Bảng tin').hasAttribute('aria-current')).toBe(false)
  })

  it('keeps screenshot conditional without placing it in the navigation list', () => {
    const onScreenshot = vi.fn()
    const first = renderSidebar('feed', false, false)
    expect(first.element.querySelector('[aria-label="Chụp màn hình"]')).toBeNull()
    const second = renderSidebar('feed', false, false, { onScreenshot })
    expect(second.button('Menu tài khoản')).not.toBeNull()
    expect(second.element.querySelector('nav[aria-label="Các khu vực"]')?.textContent).not.toContain('Chụp màn hình')
  })

  it('toggles a permanent icon rail without changing the active route', () => {
    const { button, element } = renderSidebar()
    act(() => button('Thu gọn thanh bên').click())
    expect(element.querySelector('.app-sidebar.is-collapsed')).not.toBeNull()
    expect(button('Bảng tin').getAttribute('aria-current')).toBe('page')
    act(() => button('Mở rộng thanh bên').click())
    expect(element.querySelector('.app-sidebar.is-collapsed')).toBeNull()
  })
})
