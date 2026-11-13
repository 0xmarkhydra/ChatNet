// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatPins } from './useChatPins'
import type { Message } from '../types'

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
