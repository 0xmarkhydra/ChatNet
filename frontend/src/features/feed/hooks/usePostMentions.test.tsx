// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest } from '../../../shared/types/api'
import { usePostMentions } from './usePostMentions'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const oldAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = true })

function deferred() {
  let resolve!: (result: Response) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Response>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const mention = (id: number) => ({
  id, postId: id, author: 'Friend', createdAt: '2026-11-14T00:00:00Z', readAt: null,
})

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const pending: ReturnType<typeof deferred>[] = []
  const request = vi.fn(() => {
    const job = deferred()
    pending.push(job)
    return job.promise
  }) as ApiRequest
  const error = vi.fn()
  let current!: ReturnType<typeof usePostMentions>
  function Probe({ sessionId, notificationsTab = false }: {
    sessionId: string; notificationsTab?: boolean
  }) {
    current = usePostMentions({ sessionId, notificationsTab, apiFetch: request, onReadError: error })
    return <span>{current.mentions.map(x => `${x.id}:${Boolean(x.readAt)}`).join(',')}</span>
  }
  return {
    host, pending, error, request,
    get current() { return current },
    async render(sessionId: string, notificationsTab = false) {
      await act(async () => root.render(<Probe sessionId={sessionId} notificationsTab={notificationsTab} />))
    },
    async close() { await act(async () => root.unmount()); host.remove() },
  }
}

afterEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = oldAct; vi.restoreAllMocks() })

describe('post mentions session and polling lifecycle', () => {
  it('clears old mentions before paint on A → B → A and ignores the first A response', async () => {
    const probe = setup()
    try {
      await probe.render('A')
      expect(probe.pending).toHaveLength(1)
      await act(async () => probe.pending[0].resolve(Response.json([mention(1)])))
      expect(probe.host.textContent).toBe('1:false')

      await probe.render('B')
      expect(probe.host.textContent).toBe('')
      await probe.render('A')
      expect(probe.host.textContent).toBe('')

      const oldA = probe.pending[2]
      await probe.render('B')
      await probe.render('A')
      await act(async () => oldA.resolve(Response.json([mention(99)])))
      expect(probe.host.textContent).toBe('')
      await act(async () => probe.pending[4].resolve(Response.json([mention(3)])))
      expect(probe.host.textContent).toBe('3:false')
    } finally { await probe.close() }
  })

  it('does not surface an old read failure after switching accounts', async () => {
    const probe = setup()
    try {
      await probe.render('A')
      await act(async () => probe.pending[0].resolve(Response.json([mention(4)])))
      let action!: Promise<void>
      await act(async () => { action = probe.current.readPostMention(4) })
      expect(probe.pending).toHaveLength(2)
      await probe.render('B')
      await act(async () => probe.pending[1].reject(new Error('offline')))
      await action
      expect(probe.error).not.toHaveBeenCalled()
      expect(probe.host.textContent).toBe('')
    } finally { await probe.close() }
  })

  it('marks a mention read only when the current visit receives a successful write', async () => {
    const probe = setup()
    try {
      await probe.render('A')
      await act(async () => probe.pending[0].resolve(Response.json([mention(8)])))
      let action!: Promise<void>
      await act(async () => { action = probe.current.readPostMention(8) })
      await act(async () => probe.pending[1].resolve(new Response(null, { status: 204 })))
      await action
      expect(probe.host.textContent).toBe('8:true')
      expect(probe.error).not.toHaveBeenCalled()
      expect(probe.request).toHaveBeenCalledWith('/api/feed/mentions/8/read', { method: 'POST' })
    } finally { await probe.close() }
  })
  it('does not report a pending read error after the owner unmounts', async () => {
    const probe = setup()
    let closed = false
    try {
      await probe.render('A')
      await act(async () => probe.pending[0].resolve(Response.json([mention(9)])))
      let action!: Promise<void>
      await act(async () => { action = probe.current.readPostMention(9) })
      await probe.close()
      closed = true
      await act(async () => probe.pending[1].reject(new Error('offline')))
      await action
      expect(probe.error).not.toHaveBeenCalled()
    } finally { if (!closed) await probe.close() }
  })

})
