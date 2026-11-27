// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CallManager from './CallManager'

const mocks = vi.hoisted(() => ({
  getCurrentCalls: vi.fn(),
  notify: vi.fn(),
  dismiss: vi.fn(),
}))
vi.mock('livekit-client', () => ({ isE2EESupported: () => true }))
vi.mock('../../../platform/desktop', () => ({ isDesktopBuild: true }))
vi.mock('../../../platform/desktopMedia', () => ({ requireDesktopMedia: async () => {} }))
vi.mock('../../notifications', () => ({ notifyDesktopCall: mocks.notify, dismissDesktopCall: mocks.dismiss }))
vi.mock('./IncomingCallDialog', () => ({ default: () => <div data-testid="incoming" /> }))
vi.mock('./SecureCallRoom', () => ({ default: () => null }))
vi.mock('./CallHeaderActions', () => ({ default: () => null }))
vi.mock('../lib/calls', () => ({
  getCurrentCalls: mocks.getCurrentCalls, createCall: vi.fn(), declineCall: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('notifies once per incoming call id, even when each poll returns a new object', async () => {
  let callId = 'call-1'
  mocks.getCurrentCalls.mockImplementation(async () => [
    { id: callId, conversationId: 7, incoming: true, joined: false, status: 'ringing', mediaType: 'audio' },
  ])
  const root = createRoot(document.createElement('div'))
  const poll = async () => {
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => { vi.advanceTimersByTime(1) })
  }

  try {
    await act(async () => root.render(
      <CallManager request={vi.fn()} apiBase="" token="token" sessionId="session-1" userId={1}
        sourceLanguage="vi" targetLanguage="en" conversations={[]} />,
    ))
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(mocks.notify).toHaveBeenCalledTimes(1)

    const requests = mocks.getCurrentCalls.mock.calls.length
    await poll()
    await poll()
    expect(mocks.getCurrentCalls.mock.calls.length).toBeGreaterThan(requests)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(mocks.dismiss).not.toHaveBeenCalled()

    callId = 'call-2'
    await poll()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(mocks.dismiss).toHaveBeenCalledWith('session-1', 'call-1')
    expect(mocks.notify).toHaveBeenCalledTimes(2)
    expect(mocks.notify.mock.calls[1]?.[1]).toMatchObject({ id: 'call-2' })
  } finally {
    await act(async () => root.unmount())
  }
  expect(mocks.dismiss).toHaveBeenCalledWith('session-1', 'call-2')
})
