// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ExplorePage from './ExplorePage'
import type { DiscoverSectionProps } from '../types'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
const roots: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of roots.splice(0)) await cleanup()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function RouteLocation() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname + location.search}</output>
}

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
  const Test = () => <MemoryRouter initialEntries={[route]}>
    <ExplorePage {...props} /><RouteLocation />
  </MemoryRouter>
  roots.push(async () => { await act(async () => root.unmount()) })
  const render = async () => {
    await act(async () => root.render(<Test />))
  }
  const rerender = render
  return { host, props, render, rerender,
    route: () => host.querySelector('[data-testid="route"]')?.textContent,
    button: (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent?.trim() === label),
  }
}

const ok = (items: unknown[]) => ({ ok: true, json: async () => items }) as Response

it('renders truthful empty states and changes tabs without fabricated hashtags', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  expect(view.host.textContent).toContain('Nội dung nổi bật')
  expect(view.host.textContent).toContain('Chưa có dữ liệu hashtag thịnh hành')
  expect(view.host.textContent).toContain('Hiện chưa có cộng đồng công khai phù hợp')
  await act(async () => view.button('Mọi người')?.click())
  expect(view.host.textContent).toContain('Chưa có gợi ý từ người ở gần')
  expect(view.host.textContent).not.toContain('Đang được quan tâm')
})

it('updates tab URL and removes tab param when selecting all', async () => {
  const view = mount(vi.fn(async () => ok([])), '/discover?source=menu')
  await view.render()
  await act(async () => view.button('Cộng đồng')?.click())
  expect(view.route()).toBe('/discover?source=menu&tab=communities')
  await act(async () => view.button('Tất cả')?.click())
  expect(view.route()).toBe('/discover?source=menu')
})

it('submits trimmed search text using URL encoding but cannot submit blank text', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  const input = view.host.querySelector<HTMLInputElement>('.explore-search input')!
  const submit = view.host.querySelector<HTMLButtonElement>('.explore-search button')!
  expect(submit.disabled).toBe(true)
  expect(view.route()).toBe('/discover')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, '   ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(submit.disabled).toBe(true)
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, '  Việt Nam & AI  ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(submit.disabled).toBe(false)
  await act(async () => view.host.querySelector<HTMLFormElement>('.explore-search')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  ))
  expect(view.route()).toBe('/search?q=Vi%E1%BB%87t%20Nam%20%26%20AI')
})

it('shows nearby users and dispatches existing friend action', async () => {
  const view = mount(vi.fn(async () => ok([])), '/discover?tab=people')
  view.props.nearbyUsers = [{
    id: 23, username: 'an123', displayName: 'Bạn An', online: true,
  }]
  await view.render()
  expect(view.host.textContent).toContain('Bạn An')
  expect(view.host.textContent).toContain('@an123')
  await act(async () => view.button('Kết bạn')?.click())
  expect(view.props.actOnFriend).toHaveBeenCalledWith(view.props.nearbyUsers[0])
})

it('clears previous account communities and pending join feedback on session change', async () => {
  let resolveB!: (value: Response) => void
  const pendingB = new Promise<Response>(resolve => { resolveB = resolve })
  const request = vi.fn().mockResolvedValueOnce(ok([
    { id: 1, name: 'Nhóm của tài khoản A', visibility: 'public', memberCount: 4 },
  ])).mockReturnValueOnce(pendingB)
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  expect(view.host.textContent).toContain('Nhóm của tài khoản A')
  view.props.sessionId = 'session-b'
  await view.rerender()
  expect(view.host.textContent).not.toContain('Nhóm của tài khoản A')
  expect(view.host.querySelectorAll('.explore-skeleton')).toHaveLength(3)
  await act(async () => resolveB(ok([
    { id: 2, name: 'Nhóm của tài khoản B', visibility: 'public', memberCount: 2 },
  ])))
  expect(view.host.textContent).toContain('Nhóm của tài khoản B')
  expect(view.host.textContent).not.toContain('Nhóm của tài khoản A')
})

it('resets join message and error state on account switch', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(ok([{ id: 3, name: 'Nhóm cũ', visibility: 'public' }]))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'requested' }) } as Response)
    .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  await act(async () => view.button('Tham gia')?.click())
  expect(view.host.textContent).toContain('Đã gửi yêu cầu')
  view.props.sessionId = 'session-b'
  await view.rerender()
  expect(view.host.textContent).not.toContain('Đã gửi yêu cầu')
  expect(view.host.textContent).toContain('Không tải được cộng đồng')
  view.props.sessionId = 'session-c'
  const never = new Promise<Response>(() => {})
  request.mockReturnValueOnce(never)
  await view.rerender()
  expect(view.host.textContent).not.toContain('Không tải được cộng đồng')
  expect(view.host.textContent).not.toContain('Nhóm cũ')
})

it('does not repeat public-group fetch when switching all and communities without leaving discovery', async () => {
  const request = vi.fn(async () => ok([]))
  const view = mount(request)
  await view.render()
  await act(async () => view.button('Cộng đồng')?.click())
  await act(async () => view.button('Tất cả')?.click())
  expect(request).toHaveBeenCalledTimes(1)
})

it('shows API error and retries safely', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    .mockResolvedValueOnce(ok([{ id: 8, name: 'Nhóm thật', visibility: 'public', description: '', memberCount: 7 }]))
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  expect(view.host.textContent).toContain('Không tải được cộng đồng công khai')
  await act(async () => view.button('Thử lại')?.click())
  expect(view.host.textContent).toContain('Nhóm thật')
  expect(view.host.textContent).toContain('7 thành viên')
})

it('preserves public-group join semantics and does not invent other groups', async () => {
  const request = vi.fn(async (path: string) => path.endsWith('/join')
    ? ({ ok: true, json: async () => ({ status: 'requested' }) } as Response)
    : ok([{ id: 5, name: 'Cộng đồng thực', visibility: 'public', description: '', memberCount: 2 }]))
  const view = mount(request, '/discover?tab=communities')
  await view.render()
  await act(async () => view.button('Tham gia')?.click())
  expect(view.host.textContent).toContain('Đã gửi yêu cầu, đang chờ quản trị viên duyệt')
  expect(request).toHaveBeenCalledWith('/api/groups/5/join', { method: 'POST' })
})
