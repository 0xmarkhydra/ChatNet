// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Conversation } from '../../chat'
import type { ApiRequest } from '../../../shared/types/api'
import { useUnreadNotificationConversations } from './useUnreadNotificationConversations'

it('counts unread conversations independently of the paged chat list and reconciles realtime changes', async () => {
  vi.useFakeTimers()
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const before = globals.IS_REACT_ACT_ENVIRONMENT
  globals.IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  const root = createRoot(host)
  const rows = Array.from({length: 105}, (_, i) => ({id:i+1,unreadCount:7,name:'Chat '+i} as Conversation))
  let data = rows
  let fail = false
  const request: ApiRequest = vi.fn(async () => fail ? Response.json({}, {status:503}) : Response.json(data))
  const firstPage = rows.slice(0,25)
  function Probe({sessionId}: {sessionId:string}) {
    const unread = useUnreadNotificationConversations({sessionId,request,conversations:firstPage,active:true})
    return <span>{unread.length}</span>
  }
  try {
    await act(async () => root.render(<Probe sessionId="a" />))
    expect(host.textContent).toBe('105')
    expect(request).toHaveBeenCalledWith('/api/conversations?unread=true', expect.objectContaining({cache:'no-store'}))
    data = rows.slice(1)
    await act(async () => { window.dispatchEvent(new Event('chatnet:notification-source-changed')); await vi.advanceTimersByTimeAsync(150) })
    expect(host.textContent).toBe('104')
    fail = true
    await act(async () => { window.dispatchEvent(new Event('chatnet:notification-source-changed')); await vi.advanceTimersByTimeAsync(150) })
    expect(host.textContent).toBe('104')
    fail = false
    data = []
    await act(async () => root.render(<Probe sessionId="b" />))
    expect(host.textContent).toBe('0')
  } finally {
    await act(async () => root.unmount())
    globals.IS_REACT_ACT_ENVIRONMENT = before
    vi.useRealTimers()
  }
})
