// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeaderFeedTabs from './HeaderFeedTabs'
import { UiLocaleContext } from '../../shared/i18n/locale'

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

  it('updates all shared tabs across five locales without changing selection', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    cleanups.push(() => { act(() => root.unmount()) })
    const onChange = vi.fn()
    for (const [locale, ...labels] of [
      ['vi', 'Dành cho bạn', 'Đang theo dõi', 'Mới nhất'],
      ['en', 'For you', 'Following', 'Newest'],
      ['zh', '为你推荐', '正在关注', '最新'],
      ['ja', 'おすすめ', 'フォロー中', '最新'],
      ['ko', '추천', '팔로잉', '최신'],
    ]) {
      act(() => root.render(<UiLocaleContext.Provider value={{ locale }}><HeaderFeedTabs filter="following" onChange={onChange} /></UiLocaleContext.Provider>))
      expect(Array.from(host.querySelectorAll('[role="tab"]'), el => el.textContent)).toEqual(labels)
      expect(host.querySelector('[aria-selected="true"]')?.textContent).toBe(labels[1])
    }
    expect(onChange).not.toHaveBeenCalled()
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