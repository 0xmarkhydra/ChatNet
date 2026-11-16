// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import NearbyExplorer from './NearbyExplorer'
import { getCurrentPositionSmart } from '../lib/geolocation'
import { loadNearbyPlaces } from '../lib/nearbyPlaces'

vi.mock('./NearbyMap', () => ({ default: ({ onShowList }: { onShowList: () => void }) => <div data-testid="nearby-map"><button onClick={onShowList}>Xem danh sách</button></div> }))
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
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actGlobal.IS_REACT_ACT_ENVIRONMENT = initialAct
})
const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
  .find(item => item.textContent?.includes(label))

describe('NearbyExplorer location fallback', () => {
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
