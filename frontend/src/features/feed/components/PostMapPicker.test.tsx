// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PostMapPicker from './PostMapPicker'

const harness = vi.hoisted(() => ({
  events: new Map<string, (event: never) => void>(),
  features: [{ properties: { name: 'Cafe' } }],
}))

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  NavigationControl: class {},
  Map: class {
    on(name: string, callback: (event: never) => void) { harness.events.set(name, callback) }
    addControl() {}
    resize() {}
    remove() {}
    isStyleLoaded() { return true }
    queryRenderedFeatures() { return harness.features }
    easeTo() {}
  },
  Marker: class {
    setLngLat() { return this }
    addTo() { return this }
    remove() {}
  },
}))

let host: HTMLDivElement
let root: Root
const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const initialAct = actGlobal.IS_REACT_ACT_ENVIRONMENT
const initialResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true
  harness.events.clear()
  globalThis.ResizeObserver = class {
    observe() {}
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

describe('PostMapPicker location selection', () => {
  it('confirms selected coordinates and map feature name', async () => {
    const onConfirm = vi.fn()
    await act(async () => root.render(<PostMapPicker value="" disabled={false} onConfirm={onConfirm} />))
    await act(async () => harness.events.get('load')?.(undefined as never))
    await act(async () => harness.events.get('click')?.({
      lngLat: { wrap: () => ({ lat: 21.04, lng: 105.82 }) },
      point: { x: 2, y: 3 },
    } as never))

    expect(host.querySelector('input')?.value).toBe('Cafe')
    expect(host.textContent).toContain('21.040000, 105.820000')
    const buttons = host.querySelectorAll<HTMLButtonElement>('button')
    expect(buttons[1].disabled).toBe(false)
    await act(async () => buttons[1].click())
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 21.04, longitude: 105.82, name: 'Cafe' })
  })
})
