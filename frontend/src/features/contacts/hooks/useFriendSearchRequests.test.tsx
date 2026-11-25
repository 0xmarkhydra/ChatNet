// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest } from '../../../shared/types/api'
import type { FriendSearchResult } from '../types'
import { useFriendSearchRequests } from './useFriendSearchRequests'

const setActEnvironment = () => {
  const prior = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return () => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior }
}

afterEach(() => vi.restoreAllMocks())

describe('useFriendSearchRequests', () => {
  it('loads suggestions, debounces search and cancels stale results across sessions', async () => {
    const restore = setActEnvironment()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const calls: string[] = []
    const request: ApiRequest = async (path) => {
      calls.push(path)
      if (path.includes('search')) return Response.json([{ id: 2, username: 'searched' }])
      return Response.json([{ id: 1, username: 'suggested' }])
    }
    function Probe({ id, query = '' }: { id: string | undefined; query?: string }) {
      const [results, setResults] = useState<FriendSearchResult[]>([])
      const [searching, setSearching] = useState(false)
      const [error, setError] = useState(false)
      useFriendSearchRequests({
        sessionToken: id ? 'token' : undefined, sessionId: id,
        tab: 'contacts', desktopSection: null, newChatMode: 'friends',
        friendQuery: query, friendSearchRetry: 0, apiFetch: request,
        setFriendResults: setResults, setFriendSearching: setSearching, setFriendSearchError: setError,
      })
      return <span>{results.map(row => row.username).join(',')}|{searching ? 'busy' : 'idle'}|{error ? 'error' : 'ok'}</span>
    }
    try {
      await act(async () => root.render(<Probe id="A" />))
      expect(host.textContent).toContain('suggested')
      await act(async () => root.render(<Probe id="A" query="hello" />))
      expect(calls.some(path => path.includes('search'))).toBe(false)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)) })
      expect(calls).toContain('/api/users/search?q=hello')
      expect(host.textContent).toContain('searched')
      await act(async () => root.render(<Probe id={undefined} />))
      expect(host.textContent).toContain('|idle|ok')
      expect(host.textContent).not.toContain('searched')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      restore()
    }
  })
})
