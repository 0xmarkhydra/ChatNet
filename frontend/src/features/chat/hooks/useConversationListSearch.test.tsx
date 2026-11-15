// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConversationListSearch } from './useConversationListSearch'
import { CHAT_LIST_PAGE_SIZE } from '../types'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const oldAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = oldAct; vi.restoreAllMocks() })

function deferred() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const pending: ReturnType<typeof deferred>[] = []
  const request = vi.fn(() => {
    const next = deferred()
    pending.push(next)
    return next.promise
  })
  let latest!: ReturnType<typeof useConversationListSearch>
  function Probe({ sessionId, query, filter = 'all' }: {
    sessionId: string; query: string; filter?: 'all' | 'groups'
  }) {
    latest = useConversationListSearch({
      sessionId, query, filter, categoryId: null, enabled: true, request,
    })
    return <output>{latest.items.map(item => item.id).join(',')}</output>
  }
  return {
    host, request, pending,
    get current() { return latest },
    async render(sessionId: string, query = 'hello', filter: 'all' | 'groups' = 'all') {
      await act(async () => root.render(<Probe sessionId={sessionId} query={query} filter={filter} />))
    },
    async startSearch() {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 470)) })
    },
    async close() { await act(async () => root.unmount()); host.remove() },
  }
}

describe('conversation list search visit ownership', () => {
  it('does not resurrect previously loaded A results after A → B → A', async () => {
    const probe = setup()
    try {
      await probe.render('A')
      await probe.startSearch()
      expect(probe.pending).toHaveLength(1)
      await act(async () => probe.pending[0].resolve(Response.json([{ id: 11 }])))
      expect(probe.host.textContent).toBe('11')

      await probe.render('B')
      expect(probe.host.textContent).toBe('')
      await probe.render('A')
      expect(probe.host.textContent).toBe('')
      expect(probe.current.loading).toBe(true)
      await probe.startSearch()
      expect(probe.pending).toHaveLength(2)
      await act(async () => probe.pending[1].resolve(Response.json([{ id: 33 }])))
      expect(probe.host.textContent).toBe('33')
    } finally {
      await probe.close()
    }
  })

  it('drops late results when the filter changes and then returns to the original filter', async () => {
    const probe = setup()
    try {
      await probe.render('A', 'hello', 'all')
      await probe.startSearch()
      const old = probe.pending[0]
      await probe.render('A', 'hello', 'groups')
      await probe.render('A', 'hello', 'all')
      expect(probe.host.textContent).toBe('')
      await act(async () => old.resolve(Response.json([{ id: 99 }])))
      expect(probe.host.textContent).toBe('')
      await probe.startSearch()
      expect(probe.pending).toHaveLength(2)
      await act(async () => probe.pending[1].resolve(Response.json([{ id: 44 }])))
      expect(probe.host.textContent).toBe('44')
    } finally {
      await probe.close()
    }
  })
  it('does not merge an old paginated page into a different account visit', async () => {
    const probe = setup()
    try {
      await probe.render('A')
      await probe.startSearch()
      const firstPage = Array.from({ length: CHAT_LIST_PAGE_SIZE }, (_, i) => ({ id: i + 1 }))
      await act(async () => probe.pending[0].resolve(Response.json(firstPage)))
      expect(probe.current.hasMore).toBe(true)

      let page!: Promise<void>
      await act(async () => { page = probe.current.loadMore() })
      expect(probe.pending).toHaveLength(2)
      await probe.render('B')
      await probe.render('A')
      expect(probe.host.textContent).toBe('')
      await act(async () => probe.pending[1].resolve(Response.json([{ id: 999 }])))
      await page
      expect(probe.host.textContent).toBe('')
      await probe.startSearch()
      expect(probe.pending).toHaveLength(3)
      await act(async () => probe.pending[2].resolve(Response.json([{ id: 101 }])))
      expect(probe.host.textContent).toBe('101')
      expect(probe.current.loadingMore).toBe(false)
    } finally {
      await probe.close()
    }
  })

})
