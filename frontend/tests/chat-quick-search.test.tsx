// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useChatQuickSearch } from '../src/features/chat/hooks/useChatQuickSearch'
import type { ApiRequest } from '../src/shared/types/api'

describe('useChatQuickSearch query isolation', () => {
  it('hides old results immediately when search changes or retries', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const observations: ReturnType<typeof useChatQuickSearch>[] = []
    const request = (async () => new Response(JSON.stringify({
      contacts: [{ id: 10, name: 'Found' }], messages: [], files: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as ApiRequest
    function Probe({ keyword }: { keyword: string }) {
      const result = useChatQuickSearch({ keyword, sessionId: 'A', enabled: true, request })
      useLayoutEffect(() => { observations.push(result) })
      return <div>{result.loading ? 'loading' : result.results.contacts.length}</div>
    }
    const render = async (keyword: string) => {
      await act(async () => root.render(<Probe keyword={keyword} />))
      return observations.at(-1)!
    }
    try {
      const first = await render('one')
      expect(first.loading).toBe(true)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 560)) })
      expect(host.textContent).toBe('1')
      const second = await render('two')
      expect(second.loading).toBe(true)
      expect(second.results.contacts).toEqual([])
      await act(async () => second.retry())
      expect(observations.at(-1)?.loading).toBe(true)
      expect(observations.at(-1)?.results.contacts).toEqual([])
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 560)) })
      expect(host.textContent).toBe('1')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
