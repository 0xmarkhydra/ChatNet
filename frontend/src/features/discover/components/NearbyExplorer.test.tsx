// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import NearbyExplorer from './NearbyExplorer'
import { getCurrentPositionSmart } from '../lib/geolocation'

vi.mock('./NearbyMap', () => ({ default: () => <div data-testid="nearby-map" /> }))
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
