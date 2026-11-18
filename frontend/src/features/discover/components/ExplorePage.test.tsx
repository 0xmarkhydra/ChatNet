// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ExplorePage from './ExplorePage'
import type { DiscoverSectionProps } from '../types'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
const roots: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of roots.splice(0)) await cleanup()
  document.body.innerHTML = ''
})

function mount(request: DiscoverSectionProps['request'], route = '/discover') {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props: DiscoverSectionProps = {
    request, sessionId: 'session-a', actOnFriend: vi.fn(async () => {}),
    findNearby: vi.fn(async () => {}), friendActionBusy: null,
    friendRelationship: () => 'none', globalSearch: '',
    nearbyBusy: false, nearbyRadiusKm: 5, nearbyResultRadiusKm: 5,
    nearbyScanning: false, nearbyUntil: 0, nearbyUsers: [],
    setGlobalSearch: vi.fn(), setNearbyRadiusKm: vi.fn(), stopNearby: vi.fn(async () => {}),
  }
  roots.push(async () => { await act(async () => root.unmount()) })
  return { host, props, render: async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={[route]}><ExplorePage {...props} /></MemoryRouter>))
  } }
}
const ok = (items: unknown[]) => ({
  ok: true, json: async () => items,
}) as Response

it('renders truthful empty states and changes tabs without fabricated hashtags', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  expect(view.host.textContent).toContain('Chưa có dữ liệu hashtag thịnh hành')
  expect(view.host.textContent).toContain('Hiện chưa có cộng đồng công khai phù hợp')
  const people = [...view.host.querySelectorAll('button')].find(button => button.textContent === 'Mọi người')
  await act(async () => people?.click())
  expect(view.host.textContent).toContain('Chưa có gợi ý từ người ở gần')
  expect(view.host.textContent).not.toContain('Đang được quan tâm')
})

it('shows API error and retries safely', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    .mockResolvedValueOnce(ok([{ id: 8, name: 'Nhóm thật', visibility: 'public', description: '', memberCount: 7 }]))
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  expect(view.host.textContent).toContain('Không tải được cộng đồng công khai')
  await act(async () => [...view.host.querySelectorAll('button')].find(button => button.textContent === 'Thử lại')?.click())
  expect(view.host.textContent).toContain('Nhóm thật')
  expect(view.host.textContent).toContain('7 thành viên')
})

it('preserves public-group join semantics and does not invent other groups', async () => {
  const request = vi.fn(async (path: string) => path.endsWith('/join')
    ? ({ ok: true, json: async () => ({ status: 'requested' }) } as Response)
    : ok([{ id: 5, name: 'Cộng đồng thực', visibility: 'public', description: '', memberCount: 2 }]))
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  await act(async () => [...view.host.querySelectorAll('button')].find(button => button.textContent === 'Tham gia')?.click())
  expect(view.host.textContent).toContain('Đã gửi yêu cầu, đang chờ quản trị viên duyệt')
  expect(request).toHaveBeenCalledWith('/api/groups/5/join', { method: 'POST' })
})
