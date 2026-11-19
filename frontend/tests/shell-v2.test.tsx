// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageHeader from '../src/shared/ui/PageHeader'

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
