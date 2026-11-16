// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useCommunityDiscovery } from './useCommunityDiscovery'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  join: vi.fn(),
}))
vi.mock('../api/community', () => ({
  listPublicGroups: mocks.list,
  joinPublicGroup: mocks.join,
}))
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const roots: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of roots.splice(0)) await cleanup()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function mount({ active = true, query = '' }: { active?: boolean; query?: string } = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => ({ ok: true }) as Response)
  const notify = vi.fn()
  const onJoinedGroup = vi.fn(async () => {})
  let state!: ReturnType<typeof useCommunityDiscovery>

  function Test({ isActive, search }: { isActive: boolean; search: string }) {
    state = useCommunityDiscovery({ active: isActive, query: search, request, notify, onJoinedGroup })
    return null
  }
  const render = async (isActive = active, search = query) => {
    await act(async () => root.render(<Test isActive={isActive} search={search} />))
  }
  let mounted = true
  const unmount = async () => {
    if (!mounted) return
    mounted = false
    await act(async () => root.unmount())
  }
  roots.push(unmount)
  return { render, unmount, get state() { return state }, notify, onJoinedGroup, request }
}

it('ignores a stale list response after search changes and aborts the previous request', async () => {
  const first = deferred<Response>()
  const second = deferred<Response>()
  mocks.list.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
  const view = mount()
  await view.render(true, 'nhóm A')
  await view.render(true, 'nhóm B')
  expect(mocks.list).toHaveBeenCalledTimes(2)
  expect((mocks.list.mock.calls[0][2] as AbortSignal).aborted).toBe(true)

  await act(async () => {
    second.resolve({ ok: true, json: async () => [{ id: 2, name: 'B' }] } as Response)
  })
  expect(view.state.publicGroups).toEqual([{ id: 2, name: 'B' }])
  await act(async () => {
    first.resolve({ ok: true, json: async () => [{ id: 1, name: 'A' }] } as Response)
  })
  expect(view.state.publicGroups).toEqual([{ id: 2, name: 'B' }])
  expect(view.state.publicLoading).toBe(false)
})

it('stops discovery when leaving the list and preserves the existing join response semantics', async () => {
  mocks.list.mockResolvedValue({
    ok: true, json: async () => [{ id: 12, name: 'Public' }],
  } as Response)
  mocks.join.mockResolvedValue({
    ok: true, json: async () => ({ status: 'member' }),
  } as Response)
  const view = mount()
  await view.render()
  expect(view.state.publicGroups).toHaveLength(1)
  await act(async () => view.state.joinPublic(12))
  expect(view.notify).toHaveBeenCalledWith('Đã tham gia cộng đồng.')
  expect(view.onJoinedGroup).toHaveBeenCalledWith(12)
  expect(view.state.joiningId).toBeNull()
  await view.render(false, '')
  expect(view.state.publicGroups).toEqual([])
  expect(mocks.list).toHaveBeenCalledTimes(1)
})

it('allows only one join request before React commits busy state and releases the guard afterward', async () => {
  mocks.list.mockResolvedValue({ ok: true, json: async () => [] } as Response)
  const first = deferred<Response>()
  mocks.join.mockImplementationOnce(() => first.promise)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'requested' }) } as Response)
  const view = mount()
  await view.render()

  let firstCall!: Promise<void>
  await act(async () => {
    firstCall = view.state.joinPublic(12)
    await view.state.joinPublic(13)
  })
  expect(mocks.join).toHaveBeenCalledTimes(1)
  expect(view.state.joiningId).toBe(12)

  await act(async () => {
    first.resolve({ ok: true, json: async () => ({ status: 'member' }) } as Response)
    await firstCall
  })
  expect(view.onJoinedGroup).toHaveBeenCalledTimes(1)
  expect(view.state.joiningId).toBeNull()
  await act(async () => view.state.joinPublic(13))
  expect(mocks.join).toHaveBeenCalledTimes(2)
})

it('unlocks joining after an HTTP failure without retrying the failed mutation automatically', async () => {
  mocks.list.mockResolvedValue({ ok: true, json: async () => [] } as Response)
  mocks.join
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Không có quyền tham gia' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'requested' }) } as Response)
  const view = mount()
  await view.render()

  await act(async () => view.state.joinPublic(12))
  expect(view.notify).toHaveBeenCalledWith('Không có quyền tham gia')
  expect(view.state.joiningId).toBeNull()
  expect(view.onJoinedGroup).not.toHaveBeenCalled()
  expect(mocks.join).toHaveBeenCalledTimes(1)

  await act(async () => view.state.joinPublic(13))
  expect(mocks.join).toHaveBeenCalledTimes(2)
  expect(view.notify).toHaveBeenCalledWith('Đã gửi yêu cầu tham gia. Chờ quản trị viên duyệt.')
  expect(view.state.joiningId).toBeNull()
})

it('ignores late discovery responses after leaving list mode', async () => {
  const pending = deferred<Response>()
  mocks.list.mockReturnValue(pending.promise)
  const view = mount()
  await view.render(true, 'đang tìm')
  expect(view.state.publicLoading).toBe(true)
  await view.render(false, 'đang tìm')
  expect((mocks.list.mock.calls[0][2] as AbortSignal).aborted).toBe(true)
  await act(async () => {
    pending.resolve({ ok: true, json: async () => [{ id: 99, name: 'Đã cũ' }] } as Response)
  })
  expect(view.state.publicGroups).toEqual([])
  expect(view.state.publicLoading).toBe(false)
})

it('does not notify or refresh a departed community screen after join succeeds', async () => {
  mocks.list.mockResolvedValue({ ok: true, json: async () => [] } as Response)
  const pending = deferred<Response>()
  mocks.join.mockReturnValue(pending.promise)
  const view = mount()
  await view.render()
  let joined!: Promise<void>
  await act(async () => { joined = view.state.joinPublic(12) })
  await view.unmount()
  await act(async () => {
    pending.resolve({ ok: true, json: async () => ({ status: 'member' }) } as Response)
    await joined
  })
  expect(view.notify).not.toHaveBeenCalled()
  expect(view.onJoinedGroup).not.toHaveBeenCalled()
})

it('does not surface a stale join failure after leaving the community screen', async () => {
  mocks.list.mockResolvedValue({ ok: true, json: async () => [] } as Response)
  const pending = deferred<Response>()
  mocks.join.mockReturnValue(pending.promise)
  const view = mount()
  await view.render()
  let joined!: Promise<void>
  await act(async () => { joined = view.state.joinPublic(12) })
  await view.unmount()
  await act(async () => {
    pending.resolve({ ok: false, json: async () => ({ error: 'Không thể tham gia' }) } as Response)
    await joined
  })
  expect(view.notify).not.toHaveBeenCalled()
  expect(view.onJoinedGroup).not.toHaveBeenCalled()
})
