// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { getCurrentPositionSmart } from '../lib/geolocation'
import { useNearbyDiscovery } from './useNearbyDiscovery'

vi.mock('../lib/geolocation', () => ({
  getCurrentPositionSmart: vi.fn(),
  geolocationErrorMessage: vi.fn(async () => 'Location unavailable'),
}))

describe('nearby discovery concurrency', () => {
  it('sends just one location scan when invoked twice before React updates busy state', async () => {
    const globalAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previousAct = globalAct.IS_REACT_ACT_ENVIRONMENT
    globalAct.IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const responsePending: Array<(response: Response) => void> = []
    const apiFetch = vi.fn(() => new Promise<Response>(resolve => responsePending.push(resolve)))
    vi.mocked(getCurrentPositionSmart).mockResolvedValue({ coords: { latitude: 21, longitude: 105 } } as GeolocationPosition)
    const session = { sessionId: 'session-a' } as Session
    const sessionRef = { current: session }
    const nearbyRequest = { current: 0 }
    const setNearbyBusy = vi.fn()
    let findNearby: (() => Promise<void>) | undefined
    function Probe() {
      const actions = useNearbyDiscovery({
        apiFetch,
        nearbyBusy: false,
        nearbyRadiusKm: 5,
        nearbyRequest,
        session,
        sessionRef,
        setNearbyBusy,
        setNearbyResultRadiusKm: vi.fn(),
        setNearbyScanning: vi.fn(),
        setNearbyUntil: vi.fn(),
        setNearbyUsers: vi.fn(),
        setNotice: vi.fn(),
      })
      findNearby = actions.findNearby
      return null
    }
    try {
      await act(async () => root.render(<Probe />))
      let first!: Promise<void>
      let second!: Promise<void>
      await act(async () => {
        first = findNearby!()
        second = findNearby!()
        await Promise.resolve()
      })
      expect(getCurrentPositionSmart).toHaveBeenCalledTimes(1)
      expect(apiFetch).toHaveBeenCalledTimes(1)
      await act(async () => responsePending[0](new Response(JSON.stringify({ users: [], expiresAt: new Date().toISOString() }))))
      await act(async () => { await Promise.all([first, second]) })
      expect(setNearbyBusy).toHaveBeenCalledWith(false)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      globalAct.IS_REACT_ACT_ENVIRONMENT = previousAct
      vi.clearAllMocks()
    }
  })
})
