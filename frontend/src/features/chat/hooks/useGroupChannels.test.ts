// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGroupChannels, type UseGroupChannelsDeps } from './useGroupChannels'

const mocked = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  setNotice: vi.fn(),
  sessionRef: { current: { sessionId: 'account-one' } } as { current: { sessionId: string } },
}))

vi.mock('../../../shared/context/ApiContext', () => ({
  useApi: () => ({ apiFetch: mocked.apiFetch }),
}))
vi.mock('../../../shared/context/NoticeContext', () => ({
  useNotice: () => ({ setNotice: mocked.setNotice }),
}))
vi.mock('../../../shared/context/SessionContext', () => ({
  useSession: () => ({ sessionRef: mocked.sessionRef }),
}))

describe('group channel creation races', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocked.sessionRef.current = { sessionId: 'account-one' }
  })

  it('does not switch back to a group after a delayed create response', async () => {
    let complete!: (response: unknown) => void
    mocked.apiFetch.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const setChannelSelection = vi.fn()
    const setGroupChannelState = vi.fn()
    const setGroupChannelBusy = vi.fn()
    const conversation = (id: number) => ({
      id, type: 'group' as const, name: 'Group', memberCount: 2,
      unreadCount: 0, lastMessage: '', online: false, createdAt: '',
    })
    const deps = {
      activeChannelIdRef: { current: 0 },
      activeConversation: conversation(12),
      activeGroupMember: { role: 'owner' },
      groupChannelBusy: false,
      groupChannels: [],
      messageScrollAtBottomRef: { current: true },
      setChannelSelection, setGroupChannelState, setGroupChannelBusy,
      setChatSearchJump: vi.fn(), setConversationDetailsOpen: vi.fn(),
      setHasMoreMessages: vi.fn(), setMessageActionId: vi.fn(),
      setMessageSearchOpen: vi.fn(), setMessages: vi.fn(), setReplyingTo: vi.fn(),
    } as unknown as UseGroupChannelsDeps
    let create!: ReturnType<typeof useGroupChannels>['createGroupChannel']
    const root = createRoot(document.createElement('div'))
    function Harness({ active }: { active: number }) {
      const result = useGroupChannels({ ...deps, activeConversation: conversation(active) })
      useEffect(() => { create = result.createGroupChannel }, [result.createGroupChannel])
      return null
    }
    await act(async () => root.render(createElement(Harness, { active: 12 })))
    let task!: Promise<boolean>
    await act(async () => { task = create('New', '') })
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    await act(async () => root.render(createElement(Harness, { active: 13 })))
    await act(async () => {
      complete({ ok: true, json: async () => ({ id: 99, conversationId: 12, name: 'New' }) })
      expect(await task).toBe(false)
    })
    expect(setChannelSelection).not.toHaveBeenCalled()
    expect(setGroupChannelState).not.toHaveBeenCalled()
    expect(mocked.setNotice).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})
