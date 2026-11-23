// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchResultsPage from './SearchResultsPage'

afterEach(() => vi.useRealTimers())

describe('search results page', () => {
  it('keeps category, sort, and time filters in URL and restores them on back', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-22T00:00:00.000Z'))
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const requests: string[] = []
    const request = async (path: string) => {
      requests.push(path)
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })
    }
    function LocationProbe() {
      const location = useLocation()
      const navigate = useNavigate()
      return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>back</button></>
    }

    try {
      await act(async () => root.render(<MemoryRouter initialEntries={['/search?q=kiwi&sort=newest']}>
        <LocationProbe />
        <Routes><Route path="/search" element={<SearchResultsPage request={request} sessionId="session-1" onOpenProfile={() => {}} onOpenPost={() => {}} />} /></Routes>
      </MemoryRouter>))
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      expect(requests).toHaveLength(4)
      for (const path of requests) {
        const url = new URL('https://example.test' + path)
        expect(url.searchParams.get('q')).toBe('kiwi')
        expect(url.searchParams.get('sort')).toBe('newest')
      }

      const peopleTab = [...host.querySelectorAll('button')].find(button => button.textContent === 'Mọi người')
      expect(peopleTab).toBeTruthy()
      await act(async () => peopleTab?.click())
      expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('?q=kiwi&sort=newest&type=people')
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })

      const recentRange = [...host.querySelectorAll('button')].find(button => button.textContent === '30 ngày qua')
      expect(recentRange).toBeTruthy()
      await act(async () => recentRange?.click())
      expect(host.querySelector('[data-testid="location"]')?.textContent).toContain('range=30d')
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      const lastPeopleRequest = requests.map(path => new URL('https://example.test' + path)).reverse().find(url =>
        url.pathname === '/api/users/search' && url.searchParams.has('since'))
      expect(lastPeopleRequest?.searchParams.get('since')).toBe('2026-10-23T00:00:00.000Z')
      expect(host.textContent).not.toContain('David Chen')
      const backButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'back')
      await act(async () => backButton?.click())
      expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('?q=kiwi&sort=newest&type=people')
      await act(async () => backButton?.click())
      expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('?q=kiwi&sort=newest')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
