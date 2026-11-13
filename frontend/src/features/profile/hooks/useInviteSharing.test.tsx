// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '../../auth/lib/session'
import { useInviteSharing } from './useInviteSharing'
import { useSession } from '../../../shared/context/SessionContext'
import { useNotice } from '../../../shared/context/NoticeContext'

vi.mock('../../../shared/context/SessionContext', () => ({ useSession: vi.fn() }))
vi.mock('../../../shared/context/NoticeContext', () => ({ useNotice: vi.fn() }))

describe('profile sharing session isolation', () => {
  it.each(['copyInviteLink', 'shareMyProfile'] as const)(
    'does not show a toast from %s after the session changes',
    async (actionName) => {
      const globalAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
      const previousAct = globalAct.IS_REACT_ACT_ENVIRONMENT
      globalAct.IS_REACT_ACT_ENVIRONMENT = true
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      const session = { sessionId: 'a', user: { username: 'alice', displayName: 'Alice' } } as Session
      const sessionRef = { current: session as Session | null }
      const notice = vi.fn()
      vi.mocked(useSession).mockReturnValue({ session, sessionRef })
      vi.mocked(useNotice).mockReturnValue({ setNotice: notice, notice: null, dismissNotice: vi.fn() })
      let resolveCopy!: () => void
      const copy = vi.fn(() => new Promise<void>(resolve => { resolveCopy = resolve }))
      const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
      const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
      let share!: ReturnType<typeof useInviteSharing>

      function Probe() {
        share = useInviteSharing({
          setActiveConversationId: vi.fn(), setFriendQuery: vi.fn(),
          setNewChatMode: vi.fn(), setQuickCreateOpen: vi.fn(), setTab: vi.fn(),
        })
        return null
      }

      try {
        await act(async () => root.render(<Probe />))
        const promise = share[actionName]()
        expect(copy).toHaveBeenCalledOnce()
        sessionRef.current = { ...session, sessionId: 'b' }
        await act(async () => resolveCopy())
        await act(async () => { await promise })
        expect(notice).not.toHaveBeenCalled()
      } finally {
        await act(async () => root.unmount())
        host.remove()
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
        else Reflect.deleteProperty(navigator, 'clipboard')
        if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
        else Reflect.deleteProperty(navigator, 'share')
        globalAct.IS_REACT_ACT_ENVIRONMENT = previousAct
        vi.clearAllMocks()
      }
    },
  )
})
