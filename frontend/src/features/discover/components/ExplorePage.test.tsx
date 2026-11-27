// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ExplorePage from './ExplorePage'
import { getCurrentPositionSmart } from '../lib/geolocation'

vi.mock('../lib/geolocation', () => ({ getCurrentPositionSmart: vi.fn(async () => ({ coords: { latitude: 21, longitude: 105 } })), geolocationErrorMessage: vi.fn(async () => 'Không lấy được vị trí') }))
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
  expect(view.props.findNearby).toHaveBeenCalledTimes(1)
  expect(view.props.setGlobalSearch).toHaveBeenCalledWith('')
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
  const request = vi.fn(async (_path: string) => ok([]))
  const view = mount(request)
  await view.render()
  await act(async () => view.button('Cộng đồng')?.click())
  await act(async () => view.button('Tất cả')?.click())
  expect(request.mock.calls.filter(([path]) => String(path).startsWith('/api/groups/public'))).toHaveLength(1)
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
  const request = vi.fn(async (_path: string) => ok([
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
  expect(request.mock.calls.filter(([path]) => String(path).startsWith('/api/groups/public'))).toHaveLength(1)
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
  await act(async () => view.button('Xem bài viết gần đây')?.click())
  expect(view.route()).toBe('/discover?tab=posts')
  const nearby = mount(vi.fn(async () => ok([])))
  await nearby.render()
  await act(async () => nearby.button('Tìm người gần đây')?.click())
  expect(nearby.route()).toBe('/discover?tab=recent')
  expect(nearby.props.findNearby).toHaveBeenCalledTimes(1)
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

it('loads real suggestions without location and supports friend actions', async () => {
  const user = { id: 41, username: 'linh', displayName: 'Bạn Linh', online: false }
  const request = vi.fn(async (path: string) => ok(path === '/api/users/suggestions' ? [user] : []))
  const view = mount(request, '/discover?tab=people')
  await view.render()
  expect(view.host.textContent).toContain('Bạn Linh')
  expect(view.props.findNearby).not.toHaveBeenCalled()
  await act(async () => view.button('Kết bạn')?.click())
  expect(view.props.actOnFriend).toHaveBeenCalledWith(user)
})

it('only searches after consent and shows public posts within the selected radius', async () => {
  const posts = [
    { id: 42, author: 'linh', content: 'Bài viết thật', visibility: 'public', distanceMeters: 1200 },
    { id: 43, author: 'linh', content: 'Riêng tư', visibility: 'private', distanceMeters: 100 },
    { id: 44, author: 'linh', content: 'Ngoài bán kính', visibility: 'public', distanceMeters: 6000 },
  ]
  const request = vi.fn(async (_path: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ posts, nextCursor: null }) }) as Response)
  const view = mount(request, '/discover?tab=posts')
  await view.render()
  expect(request).not.toHaveBeenCalled()
  expect(getCurrentPositionSmart).not.toHaveBeenCalled()
  await act(async () => view.button('Tìm bài viết gần tôi')?.click())
  expect(request.mock.calls[0]?.[0]).toBe('/api/posts/nearby')
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ latitude: 21, longitude: 105, radiusKm: 5 })
  expect(view.host.textContent).toContain('Bài viết thật')
  expect(view.host.textContent).toContain('1,2 km')
  expect(view.host.textContent).not.toContain('Riêng tư')
  expect(view.host.textContent).not.toContain('Ngoài bán kính')
  expect(view.host.querySelector('a[href="/feed/posts/42"]')).not.toBeNull()
  const radius = view.host.querySelector<HTMLButtonElement>('button[aria-label="Bán kính bài viết"]')!
  await act(async () => { radius.focus(); radius.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  const options = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
  expect(options.map(option => option.textContent?.trim())).toEqual(['1 km', '5 km', '10 km', '25 km', '50 km'])
  expect(options.find(option => option.textContent?.trim() === '5 km')?.getAttribute('aria-checked')).toBe('true')
  await act(async () => options.find(option => option.textContent?.trim() === '10 km')?.click())
  expect(radius.textContent).toContain('10 km')
  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).radiusKm).toBe(10)
  expect(view.host.textContent).toContain('Ngoài bán kính')
})

it('paginates nearby posts by distance and id and retries without duplication', async () => {
  const first = Array.from({ length: 15 }, (_, index) => ({ id: 30 - index, author: 'an', content: 'Bài ' + (30 - index), visibility: 'public', distanceMeters: 200 + index * 10 }))
  const last = { id: 15, author: 'an', content: 'Bài xa hơn', visibility: 'public', distanceMeters: 400 }
  const cursor = { id: 16, distanceMeters: 340 }
  let attempts = 0
  const request = vi.fn(async (_path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    if (body.cursor) {
      expect(body.cursor).toEqual(cursor)
      if (++attempts === 1) return { ok: false, status: 500 } as Response
      return { ok: true, json: async () => ({ posts: [last], nextCursor: null }) } as Response
    }
    return { ok: true, json: async () => ({ posts: first, nextCursor: cursor }) } as Response
  })
  const view = mount(request, '/discover?tab=posts')
  await view.render()
  await act(async () => view.button('Tìm bài viết gần tôi')?.click())
  await act(async () => view.button('Tải thêm bài viết')?.click())
  expect(view.host.textContent).toContain('Không tải được bài viết công khai.')
  await act(async () => view.button('Thử lại')?.click())
  expect(view.host.textContent).toContain('Bài xa hơn')
  expect(view.host.querySelectorAll('article')).toHaveLength(16)
  expect(view.button('Tải thêm bài viết')).toBeUndefined()
})

it('does not start sharing location just by opening the recent tab', async () => {
  const view = mount(vi.fn(async () => ok([])), '/discover?tab=recent')
  await view.render()
  expect(view.props.findNearby).not.toHaveBeenCalled()
})

it('opens every quick shortcut and displays its dedicated content', async () => {
  const request = vi.fn(async (path: string) => {
    if (path.startsWith('/api/groups/public')) return ok([{ id: 1, name: 'Nhóm thử', visibility: 'public' }])
    if (path.startsWith('/api/users/suggestions')) return ok([{ id: 2, username: 'an', displayName: 'Bạn An', online: false }])
    return ok([{ id: 3, author: 'an', content: 'Bài thử', visibility: 'public' }])
  })
  const view = mount(request)
  await view.render()
  for (const [index, tab, selector] of [
    [0, 'people', '.explore-main-column .explore-people'],
    [1, 'posts', '[aria-labelledby="explore-posts-title"]'],
    [2, 'communities', '.explore-main-column .explore-communities'],
    [3, 'recent', '[aria-label="Khám phá quanh đây"]'],
  ] as const) {
    await act(async () => view.button('Tất cả')?.click())
    await act(async () => view.host.querySelectorAll<HTMLButtonElement>('.explore-shortcut-grid button')[index]?.click())
    expect(view.route()).toBe('/discover?tab=' + tab)
    expect(view.host.querySelector('.explore-tabs [aria-current="page"]')).not.toBeNull()
    if (tab !== 'recent') expect(view.host.querySelector(selector)).not.toBeNull()
  }
  expect(view.props.findNearby).not.toHaveBeenCalled()
})

it('keeps post tab open and explains a missing nearby posts API', async () => {
  const request = vi.fn(async (path: string) => path.startsWith('/api/posts')
    ? ({ ok: false, status: 404 }) as Response
    : ok([]))
  const view = mount(request)
  await view.render()
  await act(async () => view.host.querySelectorAll<HTMLButtonElement>('.explore-shortcut-grid button')[1]?.click())
  expect(view.route()).toBe('/discover?tab=posts')
  await act(async () => view.button('Tìm bài viết gần tôi')?.click())
  expect(view.host.querySelector('[role="alert"]')?.textContent).toContain('404')
  expect(view.host.querySelector('[role="alert"]')?.textContent).toContain('Máy chủ')
  expect(view.button('Thử lại')).toBeDefined()
})

it('excludes accepted friends from both suggestion and nearby sources and updates when a request is accepted', async () => {
  const person = (id: number, displayName: string) => ({ id, username: 'user' + id, displayName, online: false })
  const view = mount(vi.fn(async (path: string) => ok(path === '/api/users/suggestions' ? [person(1, 'Bạn đã kết nối API'), person(3, 'Lời mời đã gửi'), person(4, 'Người mới')] : [])), '/discover?tab=people')
  view.props.nearbyUsers = [person(2, 'Bạn đã kết nối gần đây'), person(4, 'Người mới'), person(5, 'Lời mời đến')]
  const accepted = new Set([1, 2])
  view.props.friendRelationship = id => accepted.has(id) ? 'accepted' : id === 3 ? 'outgoing' : id === 5 ? 'incoming' : 'none'
  await view.render()
  expect(view.host.textContent).not.toContain('Bạn đã kết nối API')
  expect(view.host.textContent).not.toContain('Bạn đã kết nối gần đây')
  expect(view.host.querySelectorAll('.explore-person')).toHaveLength(3)
  expect(view.button('Nhắn tin')).toBeUndefined()
  expect(view.button('Hủy lời mời')).toBeDefined()
  expect(view.button('Chấp nhận')).toBeDefined()
  accepted.add(5)
  await view.rerender()
  expect(view.host.textContent).not.toContain('Lời mời đến')
  expect(view.host.querySelectorAll('.explore-person')).toHaveLength(2)
  await act(async () => view.button('Tất cả')?.click())
  expect(view.host.textContent).not.toContain('Bạn đã kết nối API')
  expect(view.host.textContent).not.toContain('Bạn đã kết nối gần đây')
})

it('renders nearby post extras as separate metadata and opens media in post detail', async () => {
  const post = { id: 42, author: 'linh', content: '👥 Cùng với @an\n😌 Đang cảm thấy bình yên\nMột buổi sáng', visibility: 'public', distanceMeters: 1200, attachments: [{ kind: 'image', name: 'Ảnh núi', url: 'https://example.invalid/mountain.jpg', storageRef: 'mountain', sizeBytes: 123, contentType: 'image/jpeg' }] }
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ posts: [post], nextCursor: null }) }) as Response)
  const view = mount(request, '/discover?tab=posts')
  await view.render()
  await act(async () => view.button('Tìm bài viết gần tôi')?.click())
  const card = view.host.querySelector('article')!
  expect(card.querySelector('.feed-post-extras')?.textContent).toContain('bình yên')
  expect(card.querySelector('.feed-post-extras')?.textContent).toContain('@an')
  expect(card.textContent).toContain('Một buổi sáng')
  expect(card.querySelector('img[alt="Ảnh núi"]')).not.toBeNull()
  expect(card.querySelector('a[href="/feed/posts/42"]')).not.toBeNull()
  await act(async () => card.querySelector<HTMLButtonElement>('button[aria-label="Xem bài viết có ảnh Ảnh núi"]')?.click())
  expect(view.route()).toBe('/feed/posts/42')
})