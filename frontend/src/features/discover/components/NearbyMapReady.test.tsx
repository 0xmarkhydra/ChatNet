// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NearbyMap from './NearbyMap'

const harness = vi.hoisted(() => ({
  events: {} as Record<string, () => void>,
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  easeTo: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: class {
    on(name: string, callback: () => void) { harness.events[name] = callback }
    resize() {}
    remove() { harness.remove() }
    isStyleLoaded() { return false }
    zoomIn() { harness.zoomIn() }
    zoomOut() { harness.zoomOut() }
    easeTo(options: unknown) { harness.easeTo(options) }
  },
  Marker: class {
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
  vi.clearAllMocks()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
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
})
