// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadNearbyPlaces } from './nearbyPlaces'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OpenStreetMap nearby provider recovery', () => {
  it('does not start any request when the caller has already canceled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()
    await expect(loadNearbyPlaces({
      latitude: 21, longitude: 105, radiusKm: 1, category: 'all',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the fallback endpoint after a provider HTTP failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        elements: [{ type: 'node', id: 1, lat: 21, lon: 105, tags: { name: 'Quán gần đây', amenity: 'cafe' } }],
      }) })
    vi.stubGlobal('fetch', fetchMock)
    const places = await loadNearbyPlaces({ latitude: 21, longitude: 105, radiusKm: 1, category: 'cafe' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(places).toHaveLength(1)
    expect(places[0].name).toBe('Quán gần đây')
  })

  it('sends a coarse search center to public providers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    await loadNearbyPlaces({ latitude: 21.123456, longitude: 105.654321, radiusKm: 1, category: 'all' })
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams
    const query = body.get('data') || ''
    expect(query).toContain('around:1000,21.123,105.654')
    expect(query).not.toContain('21.123456')
    expect(query).not.toContain('105.654321')
  })

  it('does not fall back to a second provider after the caller cancels', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const pending = loadNearbyPlaces({
      latitude: 21, longitude: 105, radiusKm: 1, category: 'all',
      signal: controller.signal,
    })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
