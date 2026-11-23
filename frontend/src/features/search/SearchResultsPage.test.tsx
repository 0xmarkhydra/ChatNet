// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SearchResultsPage from './SearchResultsPage'
import type { ApiRequest } from '../../shared/types/api'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
const stored = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value) },
  removeItem: (key: string) => { stored.delete(key) },
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() { return stored.size },
})
vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))

const roots: Array<() => Promise<void>> = []
let sessionNumber = 0
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(async () => {
  for (const cleanup of roots.splice(0)) await cleanup()
  document.body.innerHTML = ''
  vi.useRealTimers()
  stored.clear()
})

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const failed = () => ({ ok: false, json: async () => ({}) }) as Response

const people = [
  { id: 1, username: 'alice', displayName: 'Alice Nguyễn', online: true },
  { id: 2, username: 'bob', displayName: 'Bob Trần', online: false },
]
const communities = [{ id: 7, name: 'Thiết kế UI', description: 'Chia sẻ', topic: 'Design', visibility: 'public', memberCount: 1200 }]
const products = [{ id: 9, sellerId: 1, title: 'Sách thiết kế UI', description: '', priceAmount: 120000, priceUnit: 'VND', stock: 2 }]
const posts = [{ id: 11, author: 'alice', authorDisplayName: 'Alice Nguyễn', content: 'Mẹo thiết kế UI', likes: 3, liked: false, comments: [], createdAt: new Date().toISOString(), visibility: 'public' }]

function routes(overrides: Record<string, () => Response> = {}): ApiRequest {
  return vi.fn(async (path: string) => {
    for (const [prefix, respond] of Object.entries(overrides)) if (path.startsWith(prefix)) return respond()
    if (path.startsWith('/api/users/search')) return ok(people)
    if (path.startsWith('/api/groups/public')) return ok(communities)
    if (path.startsWith('/api/groups/')) return ok({})
    if (path.startsWith('/api/marketplace/products')) return ok({ products })
    if (path.startsWith('/api/posts')) return ok(posts)
    return failed()
  })
}

function RouteLocation() {
  const location = useLocation()
  return <output data-testid="route">{location.search}</output>
}

async function mount(request: ApiRequest, route: string) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props = { request, sessionId: 'session-' + (sessionNumber += 1), onOpenProfile: vi.fn(), onOpenPost: vi.fn() }
  roots.push(async () => { await act(async () => root.unmount()) })
  await act(async () => root.render(
    <MemoryRouter initialEntries={[route]}><SearchResultsPage {...props} /><RouteLocation /></MemoryRouter>,
  ))
  await act(async () => { await vi.advanceTimersByTimeAsync(600) })
  return {
    host, props,
    route: () => host.querySelector('[data-testid="route"]')?.textContent,
    button: (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent?.trim() === label),
    click: async (element: Element | undefined) => {
      expect(element).toBeTruthy()
      await act(async () => { (element as HTMLElement).click() })
      await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    },
  }
}

it('shows the no-keyword home with truthful empty states and starts a search', async () => {
  const request = routes()
  const view = await mount(request, '/search')
  expect(view.host.textContent).toContain('Có gì mới từ tìm kiếm của bạn')
  expect(view.host.textContent).toContain('Lưu một tìm kiếm để theo dõi bài viết mới')
  expect(request).not.toHaveBeenCalled()

  const input = view.host.querySelector('input[type="search"]') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'thiết kế UI')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { input.form?.requestSubmit() })
  expect(view.route()).toBe('?q=thi%E1%BA%BFt+k%E1%BA%BF+UI')
})

it('renders every result type from the real APIs and narrows by type and filter', async () => {
  const view = await mount(routes(), '/search?q=thi%E1%BA%BFt')
  const text = view.host.textContent ?? ''
  expect(text).toContain('Alice Nguyễn')
  expect(text).toContain('Mẹo thiết kế UI')
  expect(text).toContain('Thiết kế UI')
  expect(text).toContain('Sách thiết kế UI')
  expect(text).toContain('120.000 VND')

  await view.click([...view.host.querySelectorAll('aside[aria-label="Tìm kiếm và bộ lọc"] button')].find(button => button.textContent === 'Mọi người'))
  expect(view.route()).toBe('?q=thi%E1%BA%BFt&type=people')
  expect(view.host.textContent).toContain('Bob Trần')

  await view.click(view.host.querySelector('aside[aria-label="Tìm kiếm và bộ lọc"] button[aria-expanded]') ?? undefined)
  await view.click(view.button('Đang hoạt động'))
  expect(view.route()).toContain('status=online')
  expect(view.host.textContent).not.toContain('Bob Trần')
  expect(view.host.textContent).toContain('Đang lọc')

  await view.click(view.button('Xóa tất cả'))
  expect(view.route()).toBe('?q=thi%E1%BA%BFt&type=people')
})

it('explains filtered empty results and clears filters from the empty state', async () => {
  const view = await mount(routes(), '/search?q=thi%E1%BA%BFt&type=people&status=online')
  expect(view.host.textContent).toContain('Alice Nguyễn')
  const offline = await mount(routes({ '/api/users/search': () => ok([people[1]]) }), '/search?q=bob&type=people&status=online')
  expect(offline.host.textContent).toContain('Không tìm thấy kết quả cho “bob”')
  expect(offline.host.textContent).toContain('1 bộ lọc đang thu hẹp kết quả')
  await offline.click(offline.button('Bỏ bộ lọc'))
  expect(offline.route()).toBe('?q=bob&type=people')
  expect(offline.host.textContent).toContain('Bob Trần')
})

it('shows a recoverable error per section and retries only that request', async () => {
  let attempts = 0
  const request = routes({ '/api/users/search': () => (attempts += 1) === 1 ? failed() : ok(people) })
  const view = await mount(request, '/search?q=alice&type=people')
  expect(view.host.textContent).toContain('Không thể tìm người dùng. Hãy thử lại.')
  await view.click(view.button('Thử lại'))
  expect(view.host.textContent).toContain('Alice Nguyễn')
  expect(attempts).toBe(2)
})

it('joins a community once and records it as opened', async () => {
  const request = routes()
  const view = await mount(request, '/search?q=thi%E1%BA%BFt&type=communities')
  await view.click(view.button('Tham gia'))
  expect(view.button('Đã tham gia')?.disabled).toBe(true)
  expect(vi.mocked(request).mock.calls.filter(([path, init]) => path === '/api/groups/7/join' && init?.method === 'POST')).toHaveLength(1)
})

it('saves a search and lists it on the home screen', async () => {
  stored.set('socco.search.v1:old-session', JSON.stringify({ recent: ['secret'] }))
  const view = await mount(routes(), '/search?q=designer')
  await view.click(view.button('Lưu tìm kiếm'))
  expect(view.button('Đã lưu tìm kiếm')?.getAttribute('aria-pressed')).toBe('true')
  expect(stored.has('socco.search.v1:old-session')).toBe(false)
  const key = [...stored.keys()][0]
  expect(JSON.parse(stored.get(key) ?? '{}').saved[0].query).toBe('designer')
  expect(JSON.parse(stored.get(key) ?? '{}').recent).toEqual(['designer'])
})

it('ignores a late response from a previous query', async () => {
  let releaseFirst: (value: Response) => void = () => {}
  const request = vi.fn((path: string) => {
    if (path.includes('q=first')) return new Promise<Response>(resolve => { releaseFirst = resolve })
    if (path.startsWith('/api/users/search')) return Promise.resolve(ok([people[1]]))
    return Promise.resolve(ok([]))
  }) as unknown as ApiRequest
  const view = await mount(request, '/search?q=first&type=people')
  const input = view.host.querySelector('aside[aria-label="Tìm kiếm và bộ lọc"] input[type="search"]') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'second')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { input.form?.requestSubmit() })
  await act(async () => { await vi.advanceTimersByTimeAsync(600) })
  await act(async () => { releaseFirst(ok([people[0]])) })
  expect(view.host.textContent).toContain('Bob Trần')
  expect(view.host.textContent).not.toContain('Alice Nguyễn')
})

it('shows a pending request instead of membership for approval-only communities', async () => {
  const view = await mount(routes({ '/api/groups/7/join': () => ok({ status: 'pending' }) }), '/search?q=thi%E1%BA%BFt&type=communities')
  await view.click(view.button('Tham gia'))
  expect(view.button('Đã gửi yêu cầu')?.disabled).toBe(true)
  expect(view.host.textContent).not.toContain('Đã tham gia')
})

it('keeps paging posts when the loaded page is filtered out', async () => {
  const friendsOnly = [{ ...posts[0], visibility: 'friends' }, { ...posts[0], id: 12, visibility: 'friends' }, { ...posts[0], id: 13, visibility: 'friends' }, { ...posts[0], id: 14, visibility: 'friends' }, { ...posts[0], id: 15, visibility: 'friends' }]
  const view = await mount(routes({ '/api/posts': () => ok(friendsOnly) }), '/search?q=thi%E1%BA%BFt&type=posts')
  expect(view.host.textContent).not.toContain('Không tìm thấy kết quả')
  expect(view.host.textContent).toContain('Chưa thấy bài viết khớp bộ lọc trong các kết quả đã tải.')
  expect(view.button('Tải thêm bài viết')).toBeTruthy()
})

it('starts a scoped search from the home scope select', async () => {
  const view = await mount(routes(), '/search')
  const select = view.host.querySelector('select[aria-label="Phạm vi tìm kiếm"]') as HTMLSelectElement
  await act(async () => {
    select.value = 'posts'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const input = view.host.querySelector('input[type="search"]') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'figma')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { input.form?.requestSubmit() })
  expect(view.route()).toBe('?type=posts&q=figma')
})
