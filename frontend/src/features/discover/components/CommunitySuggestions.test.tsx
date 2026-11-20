// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import CommunitySuggestions from './CommunitySuggestions'

it('reuses the community section for actual joined groups without offering a second join action', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onOpenJoined = vi.fn()
  const onViewAll = vi.fn()
  try {
    act(() => root.render(<CommunitySuggestions
      title="Cộng đồng của bạn"
      joinedItems={[{ id: 42, name: 'Nhóm bạn bè', memberCount: 12 }]}
      onOpenJoined={onOpenJoined}
      onViewAll={onViewAll}
    />))
    expect(host.querySelector('section[aria-label="Cộng đồng của bạn"]')).not.toBeNull()
    expect(host.textContent).toContain('Nhóm bạn bè')
    expect(host.textContent).not.toContain('Tham gia')
    const open = host.querySelector<HTMLButtonElement>('button[aria-label="Mở cộng đồng Nhóm bạn bè"]')
    act(() => open?.click())
    expect(onOpenJoined).toHaveBeenCalledWith(42)
    const all = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Xem tất cả')
    act(() => all?.click())
    expect(onViewAll).toHaveBeenCalledOnce()
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})
