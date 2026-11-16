// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import NearbyMap from './NearbyMap'

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: class { constructor() { throw new Error('WebGL unavailable') } },
}))

let host: HTMLDivElement
let root: Root
const globalAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const initialAct = globalAct.IS_REACT_ACT_ENVIRONMENT

beforeEach(() => {
  globalAct.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  globalAct.IS_REACT_ACT_ENVIRONMENT = initialAct
})

describe('NearbyMap failure fallback', () => {
  it('offers the list when map initialization fails without revealing the engine exception', async () => {
    const onShowList = vi.fn()
    await act(async () => {
      root.render(<NearbyMap location={{ latitude: 21, longitude: 105 }}
        places={[]} selected={null} onSelect={() => {}} onShowList={onShowList} />)
    })
    await act(async () => new Promise(resolve => setTimeout(resolve, 20)))
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tải được bản đồ')
    expect(host.textContent).not.toContain('WebGL unavailable')
    const list = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Xem danh sách')
    expect(list).toBeTruthy()
    await act(async () => list?.click())
    expect(onShowList).toHaveBeenCalledOnce()
  })
})
