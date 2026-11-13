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
})
