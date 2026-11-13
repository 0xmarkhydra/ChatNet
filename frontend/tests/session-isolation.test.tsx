// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useChatQuickSearch } from '../src/features/chat/hooks/useChatQuickSearch'
import type { ApiRequest } from '../src/shared/types/api'

describe('search session isolation', () => {
  it('never exposes late session A results during B or after B → A', async () => {
    const pending: Array<{ signal?: AbortSignal; resolve: (response: Response) => void }> = []
    const request = ((_: string, options?: RequestInit) => new Promise<Response>(resolve => {
      pending.push({ signal: options?.signal ?? undefined, resolve })
    })) as ApiRequest
    const observations: ReturnType<typeof useChatQuickSearch>[] = []
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previous = globals.IS_REACT_ACT_ENVIRONMENT
    globals.IS_REACT_ACT_ENVIRONMENT = true

    function Probe({ sessionId }: { sessionId: string }) {
      const result = useChatQuickSearch({ keyword: 'hello', sessionId, enabled: true, request })
      useLayoutEffect(() => { observations.push(result) })
      return <span>{result.results.contacts.map(contact => contact.name).join(',')}</span>
    }
    const render = async (sessionId: string) => {
      await act(async () => root.render(<Probe sessionId={sessionId} />))
      return observations.at(-1)!
    }
    const response = (name: string) => new Response(JSON.stringify({
      contacts: [{ id: 1, name }], messages: [], files: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    try {
      await render('A')
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)) })
      expect(pending).toHaveLength(1)
      const original = pending[0]
      expect(original.signal?.aborted).toBe(false)

      expect((await render('B')).results.contacts).toEqual([])
      expect(original.signal?.aborted).toBe(true)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)) })
      expect(pending).toHaveLength(2)

      await act(async () => original.resolve(response('stale A')))
      expect(host.textContent).toBe('')
      await act(async () => pending[1].resolve(response('current B')))
      expect(host.textContent).toBe('current B')

      expect((await render('A')).results.contacts).toEqual([])
      expect(host.textContent).toBe('')
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)) })
      expect(pending).toHaveLength(3)
      await act(async () => pending[2].resolve(response('fresh A')))
      expect(host.textContent).toBe('fresh A')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      globals.IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})
