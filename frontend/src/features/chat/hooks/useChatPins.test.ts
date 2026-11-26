// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatPins } from './useChatPins'
import type { Conversation, Message } from '../types'

const mocked = vi.hoisted(() => ({
  listPins: vi.fn(),
  setMessagePinned: vi.fn(),
  setConversationPinned: vi.fn(),
}))

vi.mock('../api/pins', () => ({
  listPins: mocked.listPins,
  setMessagePinned: mocked.setMessagePinned,
  setConversationPinned: mocked.setConversationPinned,
}))

describe('chat pin session isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocked.listPins.mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('ignores a delayed pin acknowledgement after switching accounts', async () => {
    let finishRequest!: (response: { ok: boolean }) => void
    mocked.setMessagePinned.mockImplementation(() =>
      new Promise(resolve => { finishRequest = resolve }))
    const sessionRef = { current: { sessionId: 'old-session' } }
    const conversationRef = { current: 12 as number | null }
    const setNotice = vi.fn()
    const deps = {
      session: { sessionId: 'old-session', token: 'token' },
      sessionRef,
      activeConversationId: 12,
      activeConversationIdRef: conversationRef,
      apiFetch: vi.fn(),
      setConversations: vi.fn(),
      refreshConversations: vi.fn(async () => {}),
      setNotice,
    } as unknown as Parameters<typeof useChatPins>[0]
    let toggle!: ReturnType<typeof useChatPins>['toggleMessagePin']
    const host = document.createElement('div')
    const root = createRoot(host)
    function Harness() {
      const pins = useChatPins(deps)
      useEffect(() => { toggle = pins.toggleMessagePin }, [pins.toggleMessagePin])
      return null
    }
    await act(async () => { root.render(createElement(Harness)) })
    let task!: Promise<void>
    await act(async () => {
      task = toggle({ id: 1, conversationId: 12 } as Message)
    })
    await vi.waitFor(() => expect(finishRequest).toBeTypeOf('function'))
    sessionRef.current = { sessionId: 'new-session' }
    await act(async () => { finishRequest({ ok: true }); await task })
    expect(setNotice).not.toHaveBeenCalled()
    expect(mocked.listPins).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('does not release a new session pin lock when an old request finishes', async () => {
    const finish: Array<(response: { ok: boolean }) => void> = []
    mocked.setMessagePinned.mockImplementation(() =>
      new Promise(resolve => { finish.push(resolve) }))
    const sessionRef = { current: { sessionId: 'account-a' } }
    const deps = {
      session: { sessionId: 'account-a', token: 'token-a' },
      sessionRef,
      activeConversationId: 12,
      activeConversationIdRef: { current: 12 },
      apiFetch: vi.fn(),
      setConversations: vi.fn(),
      refreshConversations: vi.fn(async () => {}),
      setNotice: vi.fn(),
    } as unknown as Parameters<typeof useChatPins>[0]
    let toggle!: ReturnType<typeof useChatPins>['toggleMessagePin']
    let busy = false
    const root = createRoot(document.createElement('div'))
    function Harness() {
      const pins = useChatPins(deps)
      toggle = pins.toggleMessagePin
      busy = pins.pinBusy
      return null
    }
    await act(async () => { root.render(createElement(Harness)) })
    let first!: Promise<void>
    await act(async () => { first = toggle({ id: 1, conversationId: 12 } as Message) })
    expect(finish).toHaveLength(1)

    sessionRef.current = { sessionId: 'account-b' }
    deps.session = { sessionId: 'account-b', token: 'token-b' } as typeof deps.session
    await act(async () => { root.render(createElement(Harness)) })

    let second!: Promise<void>
    await act(async () => { second = toggle({ id: 1, conversationId: 12 } as Message) })
    expect(finish).toHaveLength(2)

    await act(async () => { finish[0]({ ok: true }); await first })
    expect(busy).toBe(true)
    await act(async () => { await toggle({ id: 1, conversationId: 12 } as Message) })
    expect(mocked.setMessagePinned).toHaveBeenCalledTimes(2)

    await act(async () => { finish[1]({ ok: true }); await second })
    expect(busy).toBe(false)
    await act(async () => root.unmount())
  })
})

describe('chat pin view reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocked.listPins.mockResolvedValue({ ok: true, json: async () => [] })
  })

  async function mount() {
    const sessionRef = { current: { sessionId: 'account-a' } }
    const conversationRef = { current: 12 as number | null }
    let session = { sessionId: 'account-a', token: 'token-a' }
    let pins!: ReturnType<typeof useChatPins>
    const renders: Array<{ pins: number; busy: boolean }> = []
    const apiFetch = vi.fn()
    const root = createRoot(document.createElement('div'))
    function Harness() {
      pins = useChatPins({
        session, sessionRef, activeConversationId: conversationRef.current,
        activeConversationIdRef: conversationRef, apiFetch,
        setConversations: vi.fn(), refreshConversations: async () => {}, setNotice: vi.fn(),
      } as unknown as Parameters<typeof useChatPins>[0])
      renders.push({ pins: pins.pinnedMessages.length, busy: pins.pinBusy })
      return null
    }
    const render = async (conversationId = 12, sessionId = 'account-a') => {
      conversationRef.current = conversationId
      session = { sessionId, token: 'token-' + sessionId }
      sessionRef.current = session
      await act(async () => { root.render(createElement(Harness)) })
    }
    await render()
    return { render, renders, get pins() { return pins },
      close: () => act(async () => root.unmount()) }
  }

  it.each([
    ['conversation', 13, 'account-a'],
    ['session', 12, 'account-b'],
  ])('resets pins and busy state as soon as the %s changes', async (_label, conversationId, sessionId) => {
    mocked.listPins.mockResolvedValueOnce({ ok: true, json: async () => [{ message: { id: 1 } }] })
    mocked.listPins.mockImplementation(() => new Promise(() => {}))
    mocked.setMessagePinned.mockImplementation(() => new Promise(() => {}))
    const view = await mount()
    expect(view.pins.pinnedMessages).toHaveLength(1)
    await act(async () => { void view.pins.toggleMessagePin({ id: 2, conversationId: 12 } as Message) })
    expect(view.pins.pinBusy).toBe(true)

    view.renders.length = 0
    await view.render(conversationId, sessionId)
    expect(view.renders.at(-1)).toEqual({ pins: 0, busy: false })

    // Returning to the first view must not bring the old pins or lock back.
    await view.render(12, 'account-a')
    expect(view.pins.pinnedMessages).toEqual([])
    expect(view.pins.pinBusy).toBe(false)
    await view.close()
  })

  it.each([
    ['message', 'succeeds', true], ['message', 'fails', false],
    ['conversation', 'succeeds', true], ['conversation', 'fails', false],
  ])('never leaves the next conversation busy when a late %s toggle %s', async (kind, _outcome, ok) => {
    let finish!: (response: unknown) => void
    const pending = () => new Promise(resolve => { finish = resolve })
    mocked.setMessagePinned.mockImplementation(pending)
    mocked.setConversationPinned.mockImplementation(pending)
    const view = await mount()
    let task!: Promise<void>
    await act(async () => {
      task = kind === 'message'
        ? view.pins.toggleMessagePin({ id: 1, conversationId: 12 } as Message)
        : view.pins.toggleConversationPin({ id: 12 } as Conversation)
    })
    expect(view.pins.pinBusy).toBe(true)

    await view.render(13)
    view.renders.length = 0
    await act(async () => { finish({ ok, status: ok ? 200 : 500, json: async () => ({}) }); await task })
    expect(view.pins.pinBusy).toBe(false)
    expect(view.renders.every(item => !item.busy)).toBe(true)

    await view.render(12)
    expect(view.pins.pinBusy).toBe(false)
    await view.close()
  })
})
