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

it('renders truthful empty states and never fabricates featured content or hashtags', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  expect(view.host.textContent).toContain('Bắt đầu khám phá ChatNet')
  expect(view.host.textContent).toContain('Hai bước giúp bạn kết nối nhanh nhất.')
  expect(view.host.textContent).toContain('Chưa có cộng đồng công khai nào')
  expect(view.host.textContent).not.toContain('Nội dung nổi bật')
  expect(view.host.textContent).not.toContain('hashtag')
  expect(view.host.textContent).not.toContain('Đang được quan tâm')
  expect(view.host.querySelector('.explore-rail .explore-people')).toBeNull()
  expect(view.host.querySelector('.explore-rail .explore-near')).not.toBeNull()
  expect(view.host.querySelector('.explore-communities')).toBeNull()
  expect(view.host.querySelector('.explore-topics')).toBeNull()
  await act(async () => view.button('Mọi người')?.click())
  expect(view.host.textContent).toContain('Chưa có gợi ý kết nối')
})

it('puts communities in the main column and people plus nearby card in the rail', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 4, name: 'Cộng đồng công khai', visibility: 'public', memberCount: 12 },
  ])))
  view.props.nearbyUsers = [{ id: 23, username: 'an123', displayName: 'Bạn An', online: true }]
  await view.render()
  expect(view.host.querySelector('.explore-main-column .explore-communities')).not.toBeNull()
  expect(view.host.querySelector('.explore-rail .explore-people')).not.toBeNull()
  expect(view.host.querySelector('.explore-rail .explore-near')).not.toBeNull()
  await act(async () => view.button('Quét người gần đây')?.click())
  expect(view.route()).toBe('/discover?tab=recent')
  expect(view.host.querySelector('.explore-content-layout')).toBeNull()
})

it('uses a single column without the rail on dedicated tabs', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 4, name: 'Cộng đồng công khai', visibility: 'public', memberCount: 12 },
  ])))
  await view.render()
  await act(async () => view.button('Cộng đồng')?.click())
  expect(view.host.querySelector('.explore-content-layout-single .explore-communities')).not.toBeNull()
  expect(view.host.querySelector('.explore-rail')).toBeNull()
  await act(async () => view.button('Mọi người')?.click())
  expect(view.host.querySelector('.explore-main-column .explore-people')).not.toBeNull()
  expect(view.host.querySelector('.explore-rail')).toBeNull()
})

it('updates tab URL and removes tab param when selecting all', async () => {
  const view = mount(vi.fn(async () => ok([])), '/discover?source=menu')
  await view.render()
  await act(async () => view.button('Cộng đồng')?.click())
  expect(view.route()).toBe('/discover?source=menu&tab=communities')
  await act(async () => view.button('Tất cả')?.click())
  expect(view.route()).toBe('/discover?source=menu')
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
it('derives unique topic chips from loaded community data and filters without requesting again', async () => {
  const request = vi.fn(async () => ok([
    { id: 1, name: 'Nhóm Ảnh', topic: 'Ảnh', visibility: 'public' },
    { id: 2, name: 'Nhóm Sách', topic: 'Sách', visibility: 'public' },
    { id: 3, name: 'Nhóm Ảnh khác', topic: 'Ảnh', visibility: 'public' },
    { id: 4, name: 'Nhóm không chủ đề', topic: '', visibility: 'public' },
  ]))
  const view = mount(request)
  await view.render()
  const chips = [...view.host.querySelectorAll<HTMLButtonElement>('.explore-topic-list button')]
  expect(chips.map(chip => chip.textContent)).toEqual(['Ảnh', 'Sách'])
  expect(view.host.querySelectorAll('.explore-community-card:not(.explore-skeleton)')).toHaveLength(4)
  await act(async () => chips[0].click())
  expect(chips[0].getAttribute('aria-pressed')).toBe('true')
  expect(view.host.querySelectorAll('.explore-community-card:not(.explore-skeleton)')).toHaveLength(2)
  expect(view.host.textContent).not.toContain('Nhóm Sách')
  await act(async () => chips[0].click())
  expect(chips[0].getAttribute('aria-pressed')).toBe('false')
  expect(view.host.querySelectorAll('.explore-community-card:not(.explore-skeleton)')).toHaveLength(4)
  expect(request).toHaveBeenCalledTimes(1)
})

it('hides topic chips when no topic exists in real community data', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 2, name: 'Không phân loại', topic: ' ', visibility: 'public' },
  ])))
  await view.render()
  expect(view.host.querySelector('.explore-topics')).toBeNull()
  expect(view.host.querySelector('.explore-get-started')).toBeNull()
})

it('does not show empty-state guide during initial loading or on API error', async () => {
  const pending = new Promise<Response>(() => {})
  const loading = mount(vi.fn(async () => pending))
  await loading.render()
  expect(loading.host.querySelector('.explore-get-started')).toBeNull()
  expect(loading.host.querySelectorAll('.explore-skeleton')).toHaveLength(3)
  const failure = mount(vi.fn(async () => ({ ok: false, status: 500 } as Response)))
  await failure.render()
  expect(failure.host.querySelector('.explore-get-started')).toBeNull()
  expect(failure.host.textContent).toContain('Không tải được cộng đồng công khai')
  expect(failure.button('Thử lại')).toBeDefined()
})

it('shows the guide only when communities and people are both empty', async () => {
  const empty = mount(vi.fn(async () => ok([])))
  await empty.render()
  expect(empty.host.querySelectorAll('.explore-step')).toHaveLength(2)
  expect(empty.host.textContent).not.toContain('Ba bước')
  expect(empty.host.textContent).not.toContain('Sao chép liên kết mời')
  const withPeople = mount(vi.fn(async () => ok([])))
  withPeople.props.nearbyUsers = [{ id: 4, username: 'near', displayName: 'Bạn Gần', online: true }]
  await withPeople.render()
  expect(withPeople.host.querySelector('.explore-get-started')).toBeNull()
  expect(withPeople.host.querySelector('.explore-rail .explore-person')).not.toBeNull()
  const withCommunity = mount(vi.fn(async () => ok([
    { id: 1, name: 'Nhóm thật', visibility: 'public', topic: 'Thật' },
  ])))
  await withCommunity.render()
  expect(withCommunity.host.querySelector('.explore-get-started')).toBeNull()
  expect(withCommunity.host.textContent).toContain('Nhóm thật')
})

it('hero buttons navigate to real nearby, community and post-search flows', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  await act(async () => view.button('Tham gia cộng đồng')?.click())
  expect(view.route()).toBe('/discover?tab=communities')
  await act(async () => view.button('Tất cả')?.click())
  await act(async () => view.button('Xem bài viết mới')?.click())
  expect(view.route()).toBe('/search?type=posts')
  const nearby = mount(vi.fn(async () => ok([])))
  await nearby.render()
  await act(async () => nearby.button('Tìm người gần đây')?.click())
  expect(nearby.route()).toBe('/discover?tab=recent')
})

it('guide buttons navigate to the correct tabs and keep the nearby rail on All', async () => {
  const view = mount(vi.fn(async () => ok([])))
  await view.render()
  expect(view.host.querySelector('.explore-rail .explore-near')).not.toBeNull()
  await act(async () => view.button('Xem cộng đồng')?.click())
  expect(view.route()).toBe('/discover?tab=communities')
  expect(view.host.querySelector('.explore-rail')).toBeNull()
  await act(async () => view.button('Tất cả')?.click())
  await act(async () => view.button('Quét người gần đây')?.click())
  expect(view.route()).toBe('/discover?tab=recent')
})

it('does not render fictional member counts or unused trending sections', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 8, name: 'Chưa có số liệu', topic: '', visibility: 'public' },
  ])))
  await view.render()
  expect(view.host.textContent).toContain('Chưa có số liệu')
  expect(view.host.textContent).not.toContain('thành viên')
  expect(view.host.querySelector('.explore-trending')).toBeNull()
  expect(view.host.querySelector('.explore-featured-posts')).toBeNull()
  expect(view.host.querySelector('.explore-visually-hidden')?.textContent).toBe('Khám phá')
})

it('shows all communities only after using the View All action', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 1, name: 'Hội sách', topic: 'Sách', visibility: 'public' },
  ])))
  await view.render()
  await act(async () => view.button('Xem tất cả')?.click())
  expect(view.route()).toBe('/discover?tab=communities')
  expect(view.host.querySelector('.explore-rail')).toBeNull()
  expect(view.host.querySelector('.explore-community-card')).not.toBeNull()
})
it('ignores malformed community topics without hiding valid public communities', async () => {
  const view = mount(vi.fn(async () => ok([
    { id: 1, name: 'Nhóm thiếu topic', visibility: 'public', topic: 123 },
    { id: 2, name: 'Nhóm topic hợp lệ', visibility: 'public', topic: 'Âm nhạc' },
  ])))
  await view.render()
  expect(view.host.textContent).toContain('Nhóm thiếu topic')
  expect([...view.host.querySelectorAll('.explore-topic-list button')].map(chip => chip.textContent)).toEqual(['Âm nhạc'])
})
