// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import SocialFeedSidebar from './SocialFeedSidebar'

it('shows actionable connection suggestions without the unused feed sections', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const friend = { id: 2, username: 'linh', displayName: 'Linh' }
  const request = vi.fn(async () => Response.json([friend]))
  const onFriend = vi.fn()
  const onSearchSubmit = vi.fn()
  try {
    await act(async () => root.render(
      <SocialFeedSidebar username="alice" sessionId="test-session" friends={[]} friendRequests={[]}
        friendBusyIds={new Set()} request={request} onFriend={onFriend} onViewUser={vi.fn()} onViewContacts={vi.fn()}
        onSearchSubmit={onSearchSubmit}
        communityCard={<section aria-label="Cộng đồng của bạn"><h2>Cộng đồng của bạn</h2></section>} />,
    ))
    expect(Array.from(host.querySelectorAll('aside section'), section => section.getAttribute('aria-label')))
      .toEqual(['Tìm kiếm trên Bảng tin', 'Gợi ý kết nối', 'Cộng đồng của bạn'])
    expect(host.textContent).toContain('Linh')
    expect(host.querySelector('input[aria-label="Tìm bài viết hoặc tác giả"]')?.getAttribute('value')).toBe('')
    expect(host.querySelector('[data-slot="search-field"] input[data-slot="search-field-input"]')).not.toBeNull()
    expect(host.querySelector('kbd')?.textContent).toBe('Ctrl K')
    const input = host.querySelector('input')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setValue.call(input, '  hello  ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(input.value).toBe('  hello  ')
    expect(onSearchSubmit).not.toHaveBeenCalled()
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })))
    expect(onSearchSubmit).not.toHaveBeenCalled()
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
    expect(onSearchSubmit).toHaveBeenCalledOnce()
    expect(onSearchSubmit).toHaveBeenCalledWith('hello')
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xóa từ khóa"]')?.click())
    expect(input.value).toBe('')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
    expect(onSearchSubmit).toHaveBeenCalledOnce()
    const connect = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Kết bạn')
    expect(connect).toBeDefined()
    act(() => connect?.click())
    expect(onFriend).toHaveBeenCalledWith(friend)
  } finally {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})