// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import NearbyExplorer from './NearbyExplorer'
import { getCurrentPositionSmart } from '../lib/geolocation'
import { loadNearbyPlaces } from '../lib/nearbyPlaces'

const mapBehavior = vi.hoisted(() => ({ crash: false }))
vi.mock('./NearbyMap', () => ({ default: ({ onShowList, selected }: { onShowList: () => void; selected: string | null }) => {
  if (mapBehavior.crash) throw new Error('Map rendering failed')
  return <div data-testid="nearby-map" data-selected={selected ?? ''}><button onClick={onShowList}>Xem danh sách</button></div>
} }))
vi.mock('../lib/nearbyPlaces', () => ({ loadNearbyPlaces: vi.fn(async () => []) }))
vi.mock('../lib/geolocation', () => ({
  getCurrentPositionSmart: vi.fn(),
  geolocationErrorMessage: vi.fn(async () => 'Không lấy được vị trí'),
}))

let host: HTMLDivElement
let root: Root
const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const initialAct = actGlobal.IS_REACT_ACT_ENVIRONMENT
const geo = vi.mocked(getCurrentPositionSmart)
const loadPlaces = vi.mocked(loadNearbyPlaces)
const props = {
  query: '', onQueryChange: vi.fn(), users: [], peopleBusy: false, peopleScanning: false,
  peopleActive: false, peopleRadiusKm: 1, resultRadiusKm: 1, onPeopleRadiusChange: vi.fn(),
  onScanPeople: vi.fn(), onStopPeople: vi.fn(), friendActionBusy: null,
  onFriendAction: vi.fn(), getFriendActionLabel: () => 'Kết bạn',
}

beforeEach(() => {
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.clearAllMocks()
  mapBehavior.crash = false
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actGlobal.IS_REACT_ACT_ENVIRONMENT = initialAct
})
const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
  .find(item => item.textContent?.includes(label))

describe('NearbyExplorer location fallback', () => {
  it('discloses coarse location sharing before requesting a position', async () => {
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    expect(host.textContent).toContain('vị trí gần đúng (khoảng 100 m)')
    expect(host.textContent).toContain('Overpass công cộng của OpenStreetMap')
    expect(host.textContent).toContain('Vị trí chính xác chỉ dùng trên thiết bị')
  })

  it('prevents duplicate geolocation requests before the locating state rerenders', async () => {
    let finish: ((position: GeolocationPosition) => void) | undefined
    geo.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => {
      button('Dùng vị trí hiện tại')?.click()
      button('Dùng vị trí hiện tại')?.click()
    })
    expect(geo).toHaveBeenCalledTimes(1)
    await act(async () => finish?.({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition))
    expect(host.querySelector('[data-testid="nearby-map"]')).not.toBeNull()
  })
  it('recovers after geolocation denial without retaining the old error', async () => {
    geo.mockRejectedValueOnce(new Error('Denied')).mockResolvedValueOnce(
      { coords: { latitude: 21, longitude: 105 } } as GeolocationPosition,
    )
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không lấy được vị trí')
    await act(async () => host.querySelector<HTMLButtonElement>('.nearby-refresh')?.click())
    expect(geo).toHaveBeenCalledTimes(2)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelector('[data-testid="nearby-map"]')).not.toBeNull()
  })

  it('announces pending place results and clears the status when loading finishes', async () => {
    let finishPlaces: ((places: []) => void) | undefined
    loadPlaces.mockImplementation(() => new Promise(resolve => { finishPlaces = resolve }))
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Đang tải địa điểm')
    expect(host.textContent).not.toContain('Chưa tìm thấy địa điểm')
    await act(async () => finishPlaces?.([]))
    expect(host.textContent).not.toContain('Đang tải địa điểm')
    expect(host.textContent).toContain('Chưa tìm thấy địa điểm')
  })

  it('ignores an obsolete place response after changing the category', async () => {
    let resolveOld: ((value: Awaited<ReturnType<typeof loadNearbyPlaces>>) => void) | undefined
    const stale = new Promise<Awaited<ReturnType<typeof loadNearbyPlaces>>>(resolve => { resolveOld = resolve })
    loadPlaces.mockImplementationOnce(() => stale)
      .mockResolvedValue([])
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    const category = Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-categories button'))
      .find(item => item.textContent === 'Cà phê')
    await act(async () => category?.click())
    expect(loadPlaces).toHaveBeenCalledTimes(2)
    expect(loadPlaces.mock.calls[0]?.[0].signal?.aborted).toBe(true)
    await act(async () => resolveOld?.([{
      id: 'stale', name: 'Kết quả cũ', latitude: 21, longitude: 105,
      category: 'food', distanceKm: 0.5,
    } as Awaited<ReturnType<typeof loadNearbyPlaces>>[number]]))
    expect(host.textContent).not.toContain('Kết quả cũ')
    expect(host.textContent).toContain('Chưa tìm thấy địa điểm')
  })

  it('allows changing the place radius while a request is pending and aborts the previous request', async () => {
    let resolveOld: ((items: Awaited<ReturnType<typeof loadNearbyPlaces>>) => void) | undefined
    loadPlaces.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([])
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    const radius = host.querySelector<HTMLSelectElement>('select[aria-label="Bán kính tìm kiếm"]')
    expect(radius?.disabled).toBe(false)
    await act(async () => {
      if (radius) {
        radius.value = '3'
        radius.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    expect(loadPlaces).toHaveBeenCalledTimes(2)
    expect(loadPlaces.mock.calls[0]?.[0].signal?.aborted).toBe(true)
    expect(loadPlaces.mock.calls[1]?.[0].radiusKm).toBe(3)
    await act(async () => resolveOld?.([]))
  })

  it('keeps the previous place list on a failed refresh with unchanged filters', async () => {
    const place = {
      id: 'cafe:1', name: 'Quán cà phê', category: 'cafe' as const,
      kind: 'Cafe', latitude: 21, longitude: 105, distanceKm: 0.4,
    }
    let rejectRefresh: ((error: Error) => void) | undefined
    const pending = new Promise<Awaited<ReturnType<typeof loadNearbyPlaces>>>((_, reject) => { rejectRefresh = reject })
    loadPlaces.mockResolvedValueOnce([place]).mockImplementationOnce(() => pending)
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Danh sách"]')?.click())
    expect(host.textContent).toContain('Quán cà phê')
    await act(async () => host.querySelector<HTMLButtonElement>('.nearby-refresh')?.click())
    expect(host.textContent).toContain('Quán cà phê')
    expect(host.textContent).toContain('Đang tải địa điểm')
    await act(async () => rejectRefresh?.(new Error('Mất kết nối OSM')))
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mất kết nối OSM')
    expect(host.textContent).toContain('Quán cà phê')
    expect(host.textContent).not.toContain('Đang tải địa điểm')
  })

  it('replaces stale location results after a successful retry with identical criteria', async () => {
    const oldPlace = { id: 'cafe:old', name: 'Địa điểm trước', category: 'cafe' as const,
      kind: 'Cafe', latitude: 21, longitude: 105, distanceKm: 0.4 }
    const newPlace = { ...oldPlace, id: 'cafe:new', name: 'Địa điểm mới' }
    let finishRefresh: ((value: Awaited<ReturnType<typeof loadNearbyPlaces>>) => void) | undefined
    const pending = new Promise<Awaited<ReturnType<typeof loadNearbyPlaces>>>(resolve => { finishRefresh = resolve })
    loadPlaces.mockResolvedValueOnce([oldPlace]).mockImplementationOnce(() => pending)
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.textContent).toContain('Địa điểm trước')
    await act(async () => host.querySelector<HTMLButtonElement>('.nearby-refresh')?.click())
    expect(host.textContent).toContain('Địa điểm trước')
    await act(async () => finishRefresh?.([newPlace]))
    expect(host.textContent).not.toContain('Địa điểm trước')
    expect(host.textContent).toContain('Địa điểm mới')
  })

  it('clears results when search criteria change rather than showing an old category', async () => {
    const place = { id: 'food:1', name: 'Quán ăn cũ', category: 'food' as const,
      kind: 'Restaurant', latitude: 21, longitude: 105, distanceKm: 0.5 }
    let complete: ((items: Awaited<ReturnType<typeof loadNearbyPlaces>>) => void) | undefined
    const next = new Promise<Awaited<ReturnType<typeof loadNearbyPlaces>>>(resolve => { complete = resolve })
    loadPlaces.mockResolvedValueOnce([place]).mockImplementationOnce(() => next)
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.textContent).toContain('Quán ăn cũ')
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-categories button'))
      .find(item => item.textContent === 'Cà phê')?.click())
    expect(host.textContent).not.toContain('Quán ăn cũ')
    await act(async () => complete?.([]))
    expect(host.textContent).toContain('Chưa tìm thấy địa điểm')
  })

  it('does not keep a filtered-out location selected on the map', async () => {
    const first = { id: 'shop:1', name: 'Tiệm sách', category: 'shopping' as const,
      kind: 'Bookstore', latitude: 21, longitude: 105, distanceKm: 0.4 }
    const second = { ...first, id: 'shop:2', name: 'Tiệm hoa' }
    loadPlaces.mockResolvedValue([first, second])
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} query="" />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem Tiệm sách trên bản đồ"]')?.click())
    expect(host.querySelector('[data-testid="nearby-map"]')?.getAttribute('data-selected')).toBe('shop:1')
    await act(async () => root.render(<NearbyExplorer {...props} query="hoa" />))
    expect(host.querySelector('[data-testid="nearby-map"]')?.getAttribute('data-selected')).toBe('')
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Xem Tiệm hoa trên bản đồ"]')?.getAttribute('aria-pressed')).toBe('false')
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem Tiệm hoa trên bản đồ"]')?.click())
    expect(host.querySelector('[data-testid="nearby-map"]')?.getAttribute('data-selected')).toBe('shop:2')
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Xem Tiệm hoa trên bản đồ"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('isolates a map render crash without losing the nearby places list', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mapBehavior.crash = true
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.querySelector('.nearby-map-fallback [role="alert"]')?.textContent).toContain('Không thể hiển thị bản đồ')
    expect(host.textContent).toContain('Quanh đây')
    await act(async () => button('Xem danh sách')?.click())
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Danh sách"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(host.querySelector('button[aria-label="Danh sách"]'))
    consoleError.mockRestore()
  })

  it('offers to clear a place query with no matching results without reloading the provider', async () => {
    const onQueryChange = vi.fn()
    loadPlaces.mockResolvedValue([{
      id: 'cafe:1', name: 'Cà phê trung tâm', category: 'cafe',
      kind: 'Cafe', latitude: 21, longitude: 105, distanceKm: 0.4,
    }])
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} query="không tìm thấy" onQueryChange={onQueryChange} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.textContent).toContain('Không khớp tìm kiếm')
    expect(host.textContent).not.toContain('Cà phê trung tâm')
    expect(loadPlaces).toHaveBeenCalledTimes(1)
    await act(async () => button('Xóa tìm kiếm')?.click())
    expect(onQueryChange).toHaveBeenCalledWith('')
    expect(loadPlaces).toHaveBeenCalledTimes(1)
  })

  it('lets users switch to a list when the map cannot be used', async () => {
    geo.mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.querySelector('[data-testid="nearby-map"]')).not.toBeNull()
    await act(async () => button('Xem danh sách')?.click())
    expect(host.querySelector('[data-testid="nearby-map"]')).toBeNull()
    const list = host.querySelector<HTMLButtonElement>('button[aria-label="Danh sách"]')
    expect(list?.getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(list)
  })

  it('shows an accessible location status while finding a position, without an empty prompt', async () => {
    let finish: ((position: GeolocationPosition) => void) | undefined
    geo.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await act(async () => root.render(<NearbyExplorer {...props} />))
    await act(async () => button('Địa điểm')?.click())
    await act(async () => button('Dùng vị trí hiện tại')?.click())
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Đang xác định vị trí')
    expect(host.textContent).not.toContain('Tìm địa điểm gần bạn')
    await act(async () => finish?.({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition))
    expect(host.textContent).not.toContain('Đang xác định vị trí')
  })
})
