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
  const onSearchChange = vi.fn()
  try {
    await act(async () => root.render(
      <SocialFeedSidebar username="alice" sessionId="test-session" friends={[]} friendRequests={[]}
        friendBusyIds={new Set()} request={request} onFriend={onFriend} onViewUser={vi.fn()} onViewContacts={vi.fn()}
        searchQuery="hello" onSearchChange={onSearchChange}
        communityCard={<section aria-label="Cộng đồng của bạn"><h2>Cộng đồng của bạn</h2></section>} />,
    ))
    expect(Array.from(host.querySelectorAll('aside section'), section => section.getAttribute('aria-label')))
      .toEqual(['Tìm kiếm trên Bảng tin', 'Gợi ý kết nối', 'Cộng đồng của bạn'])
    expect(host.textContent).toContain('Linh')
    expect(host.querySelector('input[aria-label="Tìm bài viết hoặc tác giả"]')?.getAttribute('value')).toBe('hello')
    expect(host.querySelector('kbd')?.textContent).toBe('Ctrl K')
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
