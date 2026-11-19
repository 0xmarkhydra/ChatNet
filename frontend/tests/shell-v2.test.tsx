// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageHeader from '../src/shared/ui/PageHeader'
import AppSidebar from '../src/app/navigation/AppSidebar'

const actEnv = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let originalAct: boolean | undefined
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  originalAct = actEnv.IS_REACT_ACT_ENVIRONMENT
  actEnv.IS_REACT_ACT_ENVIRONMENT = true
  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actEnv.IS_REACT_ACT_ENVIRONMENT = originalAct
  vi.unstubAllGlobals()
})

describe('Shell v2 page header', () => {
  it('uses semantic tablist and keyboard selection with a persistent action', async () => {
    const onTabChange = vi.fn()
    const action = vi.fn()
    await act(async () => root.render(
      <PageHeader title="Bảng tin" activeTab="all" tabs={[{ id: 'all', label: 'Dành cho bạn' }, { id: 'following', label: 'Đang theo dõi' }, { id: 'latest', label: 'Mới nhất' }]} onTabChange={onTabChange} actions={<button onClick={action}>Cộng đồng</button>} />,
    ))
    expect(host.querySelector('h1')?.textContent).toBe('Bảng tin')
    expect(host.querySelectorAll('[role="tablist"] [role="tab"]')).toHaveLength(3)
    expect(host.querySelector('[aria-selected="true"]')?.textContent).toBe('Dành cho bạn')
    await act(async () => host.querySelector('[role="tab"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(onTabChange).toHaveBeenCalledWith('following')
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Cộng đồng')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(action).toHaveBeenCalledOnce()
  })
})

function sidebar(overrides: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  return <AppSidebar
    tab="feed" section={null} username="demo" displayName="Demo" unreadTotal={3}
    notificationCount={2} feedSaved={false} settingsActive={false}
    onNavigate={vi.fn()} onSaved={vi.fn()} onSettings={vi.fn()}
    onNewPost={vi.fn()} onNewDirect={vi.fn()} onNewGroup={vi.fn()}
    onAddFriend={vi.fn()} onSell={vi.fn()} onSearch={vi.fn()}
    {...overrides}
  />
}

describe('Shell v2 sidebar', () => {
  it('collapses into a rail and expands via accessible button', async () => {
    await act(async () => root.render(sidebar()))
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="Thu gọn thanh bên"]')
    expect(toggle).not.toBeNull()
    await act(async () => toggle?.click())
    expect(host.querySelector('.app-sidebar.is-collapsed')).not.toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Mở rộng thanh bên"]')?.click())
    expect(host.querySelector('.app-sidebar.is-collapsed')).toBeNull()
    expect(host.querySelector('[aria-label="Tin nhắn"] .app-sidebar-count')?.textContent).toBe('3')
  })

  it('opens search with Ctrl K, closes on Escape, and supports scope arrows', async () => {
    await act(async () => root.render(sidebar()))
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelectorAll('[aria-label="Phạm vi tìm kiếm"] [role="tab"]')).toHaveLength(6)
    const all = document.querySelector<HTMLButtonElement>('[aria-label="Phạm vi tìm kiếm"] [role="tab"]')
    await act(async () => all?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })))
    expect(document.querySelector('[aria-label="Phạm vi tìm kiếm"] [aria-selected="true"]')?.textContent).toBe('Người')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('reuses create action callbacks through the dropdown menu', async () => {
    const onNewDirect = vi.fn()
    await act(async () => root.render(sidebar({ onNewDirect })))
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Tạo mới"]')
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu')
    await act(async () => trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(element => element.textContent?.includes('Chat riêng'))
    expect(item).toBeDefined()
    await act(async () => item?.click())
    expect(onNewDirect).toHaveBeenCalledOnce()
  })
})
