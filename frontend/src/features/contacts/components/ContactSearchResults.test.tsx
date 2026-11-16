// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ContactSearchResults from './ContactSearchResults'
import type { FriendSearchResult } from '../types'
const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
globals.IS_REACT_ACT_ENVIRONMENT = true
const results: FriendSearchResult[] = [
  { id: 11, username: 'alice', displayName: 'Alice', online: true },
  { id: 12, username: 'bob', displayName: 'Bob', online: false },
]
type Props = Parameters<typeof ContactSearchResults>[0]
const unmounts: Array<() => void> = []
function setup(patch: Partial<Props> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onAction = vi.fn(), onProfile = vi.fn(), onRetry = vi.fn()
  const props: Props = { results, loading: false, error: false, busyIds: new Set(),
    relationshipFor: (id) => id === 11 ? 'incoming' : 'none', onAction, onProfile, onRetry, ...patch }
  act(() => root.render(<ContactSearchResults {...props} />))
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  return { host, onAction, onProfile, onRetry }
}
afterEach(() => { while (unmounts.length) unmounts.pop()!() })
describe('Contacts search result states', () => {
  it('hides cached results while loading', () => {
    const app = setup({ loading: true })
    expect(app.host.getAttribute('aria-busy')).toBeNull()
    expect(app.host.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(app.host.querySelectorAll('.fd-person-row')).toHaveLength(0)
    expect(app.host.textContent).toContain('Đang tìm kiếm')
  })
  it('hides stale results on error and wires retry', () => {
    const app = setup({ error: true })
    expect(app.host.querySelectorAll('.fd-person-row')).toHaveLength(0)
    const retry = app.host.querySelector<HTMLButtonElement>('.fd-search-status button')
    expect(retry).not.toBeNull()
    act(() => retry!.click())
    expect(app.onRetry).toHaveBeenCalledOnce()
  })
  it('shows an empty message after a settled search', () => {
    const app = setup({ results: [] })
    expect(app.host.textContent).toContain('Không tìm thấy')
    expect(app.host.querySelectorAll('.fd-person-row')).toHaveLength(0)
  })
  it('opens profiles and uses actual relationship actions', () => {
    const app = setup()
    const names = [...app.host.querySelectorAll<HTMLButtonElement>('.fd-person-identity')]
    const actions = [...app.host.querySelectorAll<HTMLButtonElement>('.fd-search-action')]
    expect(names).toHaveLength(2)
    expect(actions[0].textContent).toContain('Chấp nhận')
    expect(actions[1].textContent).toContain('Kết bạn')
    act(() => { names[0].click(); actions[1].click() })
    expect(app.onProfile).toHaveBeenCalledWith(results[0])
    expect(app.onAction).toHaveBeenCalledWith(results[1])
  })
  it('disables mutation action while a request is pending', () => {
    const app = setup({ busyIds: new Set([12]) })
    const actions = [...app.host.querySelectorAll<HTMLButtonElement>('.fd-search-action')]
    expect(actions[0].disabled).toBe(false)
    expect(actions[1].disabled).toBe(true)
    expect(actions[1].textContent).toContain('Đang xử lý')
    act(() => actions[1].click())
    expect(app.onAction).not.toHaveBeenCalled()
  })
})
