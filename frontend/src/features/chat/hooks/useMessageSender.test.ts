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

async function setup() {
  const updateChatOutbox = vi.fn((transform) => transform([]))
  const setMessageDrafts = vi.fn()
  const setReplyingTo = vi.fn()
  const setChannelDrafts = vi.fn()
  const retryQueuedChatMessages = vi.fn(async () => {})
  const deps = {
    activeConversationId: 52,
    canSend: true,
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
  } as unknown as UseMessageSenderDeps
  let send!: (event: FormEvent) => Promise<void>
  const root = createRoot(document.createElement('div'))
  function Harness() {
    const current = useMessageSender(deps)
    useEffect(() => { send = current.sendMessage }, [current.sendMessage])
    return null
  }
  await act(async () => root.render(createElement(Harness)))
  const submit = async () => act(async () => {
    await send({ preventDefault: () => {} } as unknown as FormEvent)
  })
  return {
    submit,
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
    mocked.sessionRef.current = { sessionId: 'sess1', user: { id: 18 } }
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
})
