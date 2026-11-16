// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NearbyMap from './NearbyMap'

const harness = vi.hoisted(() => ({
  events: {} as Record<string, () => void>,
  markerElements: [] as HTMLButtonElement[],
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  easeTo: vi.fn(),
  remove: vi.fn(),
  mapCreated: vi.fn(),
  throwOnCreate: false,
  resizeDisconnected: vi.fn(),
}))
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: class {
    constructor() { harness.mapCreated(); if (harness.throwOnCreate) throw new Error('WebGL unavailable') }
    on(name: string, callback: () => void) { harness.events[name] = callback }
    resize() {}
    remove() { harness.remove() }
    isStyleLoaded() { return false }
    zoomIn() { harness.zoomIn() }
    zoomOut() { harness.zoomOut() }
    easeTo(options: unknown) { harness.easeTo(options) }
  },
  Marker: class {
    constructor(options: { element?: HTMLButtonElement }) {
      if (options.element) harness.markerElements.push(options.element)
    }
    setLngLat() { return this }
    addTo() { return this }
    remove() {}
  },
}))

let root: Root
let host: HTMLDivElement
const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const initialAct = actGlobal.IS_REACT_ACT_ENVIRONMENT
const initialResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true
  harness.events = {}
  harness.markerElements = []
  harness.throwOnCreate = false
  vi.clearAllMocks()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() { harness.resizeDisconnected() }
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actGlobal.IS_REACT_ACT_ENVIRONMENT = initialAct
  globalThis.ResizeObserver = initialResizeObserver
})

describe('NearbyMap marker selection', () => {
  it('announces the selected marker and updates its selected state', async () => {
    const location = { latitude: 21, longitude: 105 }
    const places = [
      { id: 'a', name: 'Cà phê A', category: 'cafe' as const, kind: 'Cafe', latitude: 21, longitude: 105, distanceKm: 0.1 },
      { id: 'b', name: 'Cà phê B', category: 'cafe' as const, kind: 'Cafe', latitude: 21.01, longitude: 105.01, distanceKm: 0.2 },
    ]
    const onSelect = vi.fn()
    await act(async () => root.render(<NearbyMap location={location} places={places}
      selected="a" onSelect={onSelect} onShowList={() => {}} />))
    const [first, second] = harness.markerElements
    expect(first?.getAttribute('aria-pressed')).toBe('true')
    expect(second?.getAttribute('aria-pressed')).toBe('false')
    expect(first?.getAttribute('aria-label')).toBe('Cà phê A')
    second?.click()
    expect(onSelect).toHaveBeenCalledWith('b')

    const nextOnSelect = vi.fn()
    await act(async () => root.render(<NearbyMap location={{ ...location }} places={places}
      selected="b" onSelect={nextOnSelect} onShowList={() => {}} />))
    expect(harness.markerElements).toHaveLength(2)
    expect(harness.markerElements[0]).toBe(first)
    expect(harness.markerElements[1]).toBe(second)
    expect(first?.getAttribute('aria-pressed')).toBe('false')
    expect(second?.getAttribute('aria-pressed')).toBe('true')
    expect(first?.classList.contains('selected')).toBe(false)
    expect(second?.classList.contains('selected')).toBe(true)
    first?.click()
    expect(nextOnSelect).toHaveBeenCalledWith('a')
    expect(harness.remove).not.toHaveBeenCalled()
  })
})

describe('NearbyMap interactive controls', () => {
  it('disables inert controls until MapLibre loads and disables them after a map error', async () => {
    await act(async () => root.render(
      <NearbyMap location={{ latitude: 21, longitude: 105 }}
        places={[]} selected={null} onSelect={() => {}} onShowList={() => {}} />,
    ))
    const controls = Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-controls button'))
    expect(controls).toHaveLength(3)
    expect(controls.every(button => button.disabled)).toBe(true)

    await act(async () => harness.events.load?.())
    expect(controls.every(button => !button.disabled)).toBe(true)
    await act(async () => controls[1].click())
    expect(harness.zoomIn).toHaveBeenCalledOnce()

    await act(async () => harness.events.error?.())
    expect(controls.every(button => button.disabled)).toBe(true)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tải được bản đồ')
  })

  it('retries after a map error, restores controls, and ignores callbacks from the disposed map', async () => {
    await act(async () => root.render(
      <NearbyMap location={{ latitude: 21, longitude: 105 }}
        places={[]} selected={null} onSelect={() => {}} onShowList={() => {}} />,
    ))
    const oldLoad = harness.events.load
    const oldError = harness.events.error
    await act(async () => harness.events.error?.())
    expect(host.querySelector('[role="alert"]')).not.toBeNull()
    const retry = Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-error button'))
      .find(button => button.textContent === 'Thử lại')
    await act(async () => retry?.click())
    expect(harness.mapCreated).toHaveBeenCalledTimes(2)
    expect(harness.remove).toHaveBeenCalledTimes(1)
    expect(harness.resizeDisconnected).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    const controls = Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-controls button'))
    expect(controls.every(button => button.disabled)).toBe(true)
    await act(async () => { oldError?.(); oldLoad?.() })
    expect(controls.every(button => button.disabled)).toBe(true)
    await act(async () => harness.events.load?.())
    expect(controls.every(button => !button.disabled)).toBe(true)
  })

  it('offers list fallback and recovery when MapLibre construction throws', async () => {
    harness.throwOnCreate = true
    const onShowList = vi.fn()
    await act(async () => root.render(
      <NearbyMap location={{ latitude: 21, longitude: 105 }} places={[]}
        selected={null} onSelect={() => {}} onShowList={onShowList} />,
    ))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-error button'))
    expect(buttons.map(button => button.textContent)).toEqual(['Xem danh sách', 'Thử lại'])
    await act(async () => buttons[0].click())
    expect(onShowList).toHaveBeenCalledOnce()
    harness.throwOnCreate = false
    await act(async () => buttons[1].click())
    expect(harness.mapCreated).toHaveBeenCalledTimes(2)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    await act(async () => harness.events.load?.())
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-controls button'))
      .every(button => !button.disabled)).toBe(true)
  })

  it('recreates the map on coordinate changes and ignores old map events', async () => {
    const location = { latitude: 21, longitude: 105 }
    await act(async () => root.render(
      <NearbyMap location={location} places={[]} selected={null} onSelect={() => {}} onShowList={() => {}} />,
    ))
    const previousError = harness.events.error
    await act(async () => root.render(
      <NearbyMap location={{ ...location, latitude: 22 }} places={[]}
        selected={null} onSelect={() => {}} onShowList={() => {}} />,
    ))
    expect(harness.mapCreated).toHaveBeenCalledTimes(2)
    expect(harness.remove).toHaveBeenCalledTimes(1)
    await act(async () => { previousError?.(); harness.events.load?.() })
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('.nearby-map-controls button'))
      .every(button => !button.disabled)).toBe(true)
  })
})
