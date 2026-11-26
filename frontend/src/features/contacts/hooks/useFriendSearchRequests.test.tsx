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
  it('does not refetch contacts when unrelated desktop panels or chat modes change', async () => {
    const restore = setActEnvironment()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const request = vi.fn(async () => Response.json([{ id: 1, username: 'suggested' }]))
    function Probe({ section, mode }: { section: 'calls' | 'groups' | null; mode: string }) {
      const [results, setResults] = useState<FriendSearchResult[]>([])
      const [, setSearching] = useState(false)
      const [, setError] = useState(false)
      useFriendSearchRequests({
        sessionToken: 'token', sessionId: 'session',
        tab: 'contacts', desktopSection: section, newChatMode: mode,
        friendQuery: '', friendSearchRetry: 0, apiFetch: request,
        setFriendResults: setResults, setFriendSearching: setSearching, setFriendSearchError: setError,
      })
      return <span>{results.length}</span>
    }
    try {
      await act(async () => root.render(<Probe section={null} mode="friends" />))
      expect(request).toHaveBeenCalledTimes(1)
      await act(async () => root.render(<Probe section="calls" mode="group" />))
      await act(async () => root.render(<Probe section="groups" mode="friends" />))
      expect(request).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      restore()
    }
  })

  it('aborts an in-flight suggestion request after the friend surface closes', async () => {
    const restore = setActEnvironment()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let finish!: (value: Response) => void
    let signal: AbortSignal | undefined
    const request: ApiRequest = async (_path, options) => {
      signal = options?.signal ?? undefined
      return new Promise(resolve => { finish = resolve })
    }
    function Probe({ tab }: { tab: 'contacts' | 'feed' }) {
      const [results, setResults] = useState<FriendSearchResult[]>([])
      const [, setSearching] = useState(false)
      const [, setError] = useState(false)
      useFriendSearchRequests({
        sessionToken: 'token', sessionId: 'session',
        tab, desktopSection: null, newChatMode: '',
        friendQuery: '', friendSearchRetry: 0, apiFetch: request,
        setFriendResults: setResults, setFriendSearching: setSearching, setFriendSearchError: setError,
      })
      return <span>{results.map(item => item.username).join(',')}</span>
    }
    try {
      await act(async () => root.render(<Probe tab="contacts" />))
      expect(signal?.aborted).toBe(false)
      await act(async () => root.render(<Probe tab="feed" />))
      expect(signal?.aborted).toBe(true)
      await act(async () => finish(Response.json([{ id: 4, username: 'stale' }])))
      expect(host.textContent).not.toContain('stale')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      restore()
    }
  })

})
