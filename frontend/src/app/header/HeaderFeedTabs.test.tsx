// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeaderFeedTabs from './HeaderFeedTabs'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
const cleanups: Array<() => void> = []
afterEach(() => { while (cleanups.length) cleanups.pop()?.() })

describe('desktop Feed header tabs', () => {
  it('maps all three tabs to existing Feed filter values without separate state', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    cleanups.push(() => { act(() => root.unmount()); host.remove() })
    const onChange = vi.fn()
    act(() => root.render(<HeaderFeedTabs filter="following" onChange={onChange} />))
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Lọc bảng tin')
    expect(tabs.map(tab => tab.textContent)).toEqual(['Dành cho bạn', 'Đang theo dõi', 'Mới nhất'])
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    act(() => tabs[2].click())
    expect(onChange).toHaveBeenCalledWith('latest')
  })

  it('shows the saved filter only when already selected', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    cleanups.push(() => { act(() => root.unmount()); host.remove() })
    act(() => root.render(<HeaderFeedTabs filter="saved" onChange={vi.fn()} />))
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Đã lưu')
  })
})
