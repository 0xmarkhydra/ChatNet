// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFeedUiState } from './useFeedUiState'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
const cleanups: Array<() => void> = []
afterEach(() => { while (cleanups.length) cleanups.pop()?.() })

function FeedFilterProbe() {
  const { feedFilter, setFeedFilter } = useFeedUiState({ tab: 'feed' })
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  return <div>
    <output data-testid="state">{feedFilter}|{pathname}{search}</output>
    <button type="button" onClick={() => setFeedFilter('following')}>Follow</button>
    <button type="button" onClick={() => setFeedFilter('latest')}>Latest</button>
    <button type="button" onClick={() => setFeedFilter('saved')}>Saved</button>
    <button type="button" onClick={() => setFeedFilter('all')}>All</button>
    <button type="button" onClick={() => navigate(-1)}>Back</button>
    <button type="button" onClick={() => navigate(1)}>Forward</button>
  </div>
}

function mount(path: string) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={[path]}><FeedFilterProbe /></MemoryRouter>))
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  const output = () => host.querySelector('output')?.textContent
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll('button')).find(el => el.textContent === label)
    if (!button) throw new Error('Missing button ' + label)
    act(() => button.click())
  }
  return { output, click }
}

describe('Feed route filters', () => {
  it('restores a deep-linked filter and preserves unrelated query parameters', () => {
    const app = mount('/feed?post=7&feed=saved')
    expect(app.output()).toBe('saved|/feed?post=7&feed=saved')
    app.click('Follow')
    expect(app.output()).toBe('following|/feed?post=7&feed=following')
  })

  it('uses a safe default for missing/invalid URL filters', () => {
    expect(mount('/feed?feed=invalid').output()).toBe('all|/feed?feed=invalid')
  })

  it('pushes browser history on selection and restores selection on Back/Forward', () => {
    const app = mount('/feed?feed=all')
    app.click('Latest')
    expect(app.output()).toBe('latest|/feed?feed=latest')
    app.click('Follow')
    expect(app.output()).toBe('following|/feed?feed=following')
    app.click('Back')
    expect(app.output()).toBe('latest|/feed?feed=latest')
    app.click('Forward')
    expect(app.output()).toBe('following|/feed?feed=following')
  })

  it('writes an explicit all filter when selected', () => {
    const app = mount('/feed')
    app.click('All')
    expect(app.output()).toBe('all|/feed?feed=all')
  })
})
