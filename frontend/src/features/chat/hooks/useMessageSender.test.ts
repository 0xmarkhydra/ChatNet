// @vitest-environment jsdom
import { act, createElement, useEffect, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageSender, type UseMessageSenderDeps } from './useMessageSender'

const mocked = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  setNotice: vi.fn(),
  sessionRef: { current: { sessionId: 'sess1', user: { id: 18 } } },
  session: { sessionId: 'sess1', user: { id: 18 } },
}))
vi.mock('../../../shared/context/ApiContext', () => ({
  useApi: () => ({ apiFetch: mocked.apiFetch }),
}))
vi.mock('../../../shared/context/NoticeContext', () => ({
  useNotice: () => ({ setNotice: mocked.setNotice }),
}))
vi.mock('../../../shared/context/SessionContext', () => ({
  useSession: () => ({ session: mocked.session, sessionRef: mocked.sessionRef }),
}))

async function setup(overrides: Partial<UseMessageSenderDeps> = {}) {
  const updateChatOutbox = vi.fn((transform) => transform([]))
  const setMessageDrafts = vi.fn()
  const setReplyingTo = vi.fn()
  const setChannelDrafts = vi.fn()
  const retryQueuedChatMessages = vi.fn(async () => {})
  const deps = {
    activeConversationId: 52,
    canSend: true,
    canSendLike: true,
    channelDraftKey: '',
    draft: { text: 'Secret', attachments: [] },
    messageText: 'Secret',
    messageAttachments: [],
    ownSendScrollConversationRef: { current: null },
    replyingTo: null,
    retryQueuedChatMessages,
    selectedChannelId: 0,
    sendingRef: { current: false },
    setChannelDrafts,
    setChatOnline: vi.fn(),
    setMessageDrafts,
    setReplyingTo,
    updateChatOutbox,
    ...overrides,
  } as unknown as UseMessageSenderDeps
  let like!: () => Promise<void>
  let send!: (event: FormEvent) => Promise<void>
  const root = createRoot(document.createElement('div'))
  function Harness() {
    const current = useMessageSender(deps)
    useEffect(() => { send = current.sendMessage; like = current.sendLike }, [current.sendMessage, current.sendLike])
    return null
  }
  await act(async () => root.render(createElement(Harness)))
  const submit = async () => act(async () => {
    await send({ preventDefault: () => {} } as unknown as FormEvent)
  })
  const begin = () => send({ preventDefault: () => {} } as unknown as FormEvent)
  return {
    submit,
    like: async () => act(async () => { await like() }),
    setReplyingTo,
    setChannelDrafts,
    begin,
    sendingRef: deps.sendingRef,
    rerender: async () => act(async () => root.render(createElement(Harness))),
    updateChatOutbox,
    retryQueuedChatMessages,
    setMessageDrafts,
    cleanup: async () => act(async () => root.unmount()),
  }
}

describe('message composer E2EE no-downgrade gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('navigator', { onLine: true })
    mocked.session = { sessionId: 'sess1', user: { id: 18 } }
    mocked.sessionRef.current = mocked.session
    mocked.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'e2ee', epoch: 1 }),
    })
  })

  it('retains plaintext draft rather than enqueueing it for MLS conversation', async () => {
    const sender = await setup()
    await sender.submit()
    expect(mocked.apiFetch).toHaveBeenCalledWith(
      '/api/conversations/52/e2ee/status', { cache: 'no-store' },
    )
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    expect(sender.setMessageDrafts).not.toHaveBeenCalled()
    expect(sender.retryQueuedChatMessages).not.toHaveBeenCalled()
    expect(mocked.setNotice).toHaveBeenCalledWith(expect.stringContaining('E2EE'), 'warning')
    await sender.cleanup()
  })

  it('does not queue an old account draft after a delayed encryption check', async () => {
    let resolveStatus!: (value: unknown) => void
    mocked.apiFetch.mockImplementation(() => new Promise(resolve => { resolveStatus = resolve }))
    const sender = await setup()
    const submission = sender.submit()
    await vi.waitFor(() => expect(resolveStatus).toBeTypeOf('function'))
    mocked.sessionRef.current = { sessionId: 'sess2', user: { id: 19 } }
    resolveStatus({ ok: true, json: async () => ({ mode: 'legacy', epoch: 0 }) })
    await submission
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    expect(sender.setMessageDrafts).not.toHaveBeenCalled()
    await sender.cleanup()
  })

  it('does not queue plaintext while automatic MLS onboarding is pending', async () => {
    mocked.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'legacy', epoch: 0, autoEnabled: true }),
    })
    const sender = await setup()
    await sender.submit()
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    expect(sender.setMessageDrafts).not.toHaveBeenCalled()
    expect(mocked.setNotice).toHaveBeenCalledWith(
      expect.stringContaining('E2EE'), 'warning',
    )
    await sender.cleanup()
  })

  it('fails closed if encryption status is unknown', async () => {
    mocked.apiFetch.mockRejectedValue(new Error('network timeout'))
    const sender = await setup()
    await sender.submit()
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    expect(sender.setMessageDrafts).not.toHaveBeenCalled()
    expect(mocked.setNotice).toHaveBeenCalledWith(
      expect.stringContaining('Không xác minh'), 'warning',
    )
    await sender.cleanup()
  })
  it('ignores stale encryption approval after A → B → A reuses a session ID', async () => {
    let resolveStatus!: (value: unknown) => void
    mocked.apiFetch.mockImplementation(() => new Promise(resolve => { resolveStatus = resolve }))
    const sender = await setup()
    const first = sender.submit()
    await vi.waitFor(() => expect(resolveStatus).toBeTypeOf('function'))

    mocked.session = { sessionId: 'sess2', user: { id: 19 } }
    mocked.sessionRef.current = mocked.session
    await sender.rerender()
    mocked.session = { sessionId: 'sess1', user: { id: 18 } }
    mocked.sessionRef.current = mocked.session
    await sender.rerender()

    resolveStatus({ ok: true, json: async () => ({ mode: 'legacy' }) })
    await first
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    expect(sender.retryQueuedChatMessages).not.toHaveBeenCalled()
    expect(sender.setMessageDrafts).not.toHaveBeenCalled()
    await sender.cleanup()
  })

  it('does not release the newer send lock when the old verification finishes', async () => {
    const approvals: Array<(value: unknown) => void> = []
    mocked.apiFetch.mockImplementation(() => new Promise(resolve => { approvals.push(resolve) }))
    const sender = await setup()
    const first = sender.begin()
    await vi.waitFor(() => expect(approvals).toHaveLength(1))

    mocked.session = { sessionId: 'sess2', user: { id: 19 } }
    mocked.sessionRef.current = mocked.session
    sender.sendingRef.current = false
    await sender.rerender()
    mocked.session = { sessionId: 'sess1', user: { id: 18 } }
    mocked.sessionRef.current = mocked.session
    await sender.rerender()
    const second = sender.begin()
    await vi.waitFor(() => expect(approvals).toHaveLength(2))
    expect(sender.sendingRef.current).toBe(true)

    approvals[0]({ ok: true, json: async () => ({ mode: 'legacy' }) })
    await first
    expect(sender.sendingRef.current).toBe(true)
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()

    approvals[1]({ ok: true, json: async () => ({ mode: 'e2ee' }) })
    await second
    expect(sender.sendingRef.current).toBe(false)
    expect(sender.updateChatOutbox).not.toHaveBeenCalled()
    await sender.cleanup()
  })

})

describe('quick Like', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('navigator', { onLine: true })
    mocked.session = { sessionId: 'sess1', user: { id: 18 } }
    mocked.sessionRef.current = mocked.session
    mocked.apiFetch.mockResolvedValue({ok:true,json:async()=>({mode:'legacy',epoch:0})})
  })
  it('queues only a Like in the selected channel and preserves the draft', async () => {
    const sender = await setup({canSend:false, selectedChannelId:7})
    try {
      await sender.like()
      const queued = sender.updateChatOutbox.mock.results[0]?.value
      expect(queued).toEqual([expect.objectContaining({conversationId:52,channelId:7,text:'👍',attachments:[],status:'queued'})])
      expect(queued[0]).not.toHaveProperty('replyToMessageId')
      expect(sender.setMessageDrafts).not.toHaveBeenCalled()
      expect(sender.setChannelDrafts).not.toHaveBeenCalled()
      expect(sender.setReplyingTo).not.toHaveBeenCalled()
      expect(sender.retryQueuedChatMessages).toHaveBeenCalledTimes(1)
    } finally { await sender.cleanup() }
  })
  it('does not bypass the encryption guard or disabled state', async () => {
    mocked.apiFetch.mockResolvedValue({ok:true,json:async()=>({mode:'e2ee',epoch:1})})
    const sender = await setup()
    try { await sender.like(); expect(sender.updateChatOutbox).not.toHaveBeenCalled() } finally { await sender.cleanup() }
    const blocked = await setup({canSendLike:false})
    try { await blocked.like(); expect(blocked.updateChatOutbox).not.toHaveBeenCalled() } finally { await blocked.cleanup() }
  })
})
