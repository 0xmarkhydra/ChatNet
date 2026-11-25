// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SecureCallRoom from './SecureCallRoom'
import type { CallRequest, CallSession } from '../lib/calls'

const mocks = vi.hoisted(() => ({ leaveCall: vi.fn(async () => {}) }))

vi.mock('../lib/calls', () => ({ endCall: vi.fn(), leaveCall: mocks.leaveCall }))
vi.mock('../hooks/useCallRoomLifecycle', () => ({ useCallRoomLifecycle: vi.fn() }))
vi.mock('../hooks/useCallMediaControls', () => ({
  useCallMediaControls: () => ({
    requestCallMediaPermission: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(), toggleScreen: vi.fn(), toggleSound: vi.fn(),
  }),
}))
vi.mock('../hooks/useCallLanguages', () => ({
  useCallLanguages: () => ({ callTargetLanguage: 'vi', setCallTargetLanguage: vi.fn(), languageOptions: [] }),
}))
vi.mock('../hooks/useCallOverlayDismiss', () => ({ useCallOverlayDismiss: vi.fn() }))
vi.mock('../hooks/useCallVoiceConsent', () => ({ useCallVoiceConsent: () => ({ updateVoiceConsent: vi.fn() }) }))
vi.mock('../hooks/useCallRemoteConsent', () => ({ useCallRemoteConsent: vi.fn() }))
vi.mock('../hooks/useCallInterpreterSessions', () => ({ useCallInterpreterSessions: vi.fn() }))
vi.mock('./CallMediaTracks', () => ({ RemoteAudioSinks: () => null }))
vi.mock('./CallRoomPanels', () => ({ CallGroupPanel: () => null, CallTranslationPanel: () => null }))
vi.mock('./CallRoomNotices', () => ({ default: () => null }))
vi.mock('./CallRoomControls', () => ({
  default: ({ closeCall }: { closeCall: (endForEveryone: boolean) => void }) => (
    <div>
      <button type="button" data-focus-first>Microphone</button>
      <button type="button">More options</button>
      <button type="button" data-call-close onClick={() => closeCall(false)}>Leave call</button>
    </div>
  ),
}))
vi.mock('./CallRoomStage', () => ({ CallRoomTopbar: () => null, CallRoomMediaStage: () => null }))

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = environment.IS_REACT_ACT_ENVIRONMENT
let host: HTMLDivElement
let root: Root
let callTrigger: HTMLButtonElement

function TestHarness() {
  const [open, setOpen] = useState(true)
  return open ? (
    <SecureCallRoom
      autoPublish={false}
      isGroup={false}
      call={{ id: 'call-1', mediaType: 'audio' } as CallSession}
      title="Aster"
      apiBase="https://api.example.test"
      request={vi.fn() as unknown as CallRequest}
      userId={1}
      sourceLanguage="en"
      targetLanguage="vi"
      canEnd={false}
      onClosed={() => setOpen(false)}
      onError={() => {}}
    />
  ) : null
}

function makeVisible(element: HTMLElement) {
  Object.defineProperty(element, 'getClientRects', {
    configurable: true,
    value: () => [{ width: 1, height: 1 }],
  })
}

beforeEach(() => {
  environment.IS_REACT_ACT_ENVIRONMENT = true
  mocks.leaveCall.mockClear()
  host = document.createElement('div')
  callTrigger = document.createElement('button')
  callTrigger.textContent = 'Start call'
  document.body.append(callTrigger, host)
  callTrigger.focus()
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  callTrigger.remove()
  environment.IS_REACT_ACT_ENVIRONMENT = previousAct
})

describe('SecureCallRoom keyboard focus', () => {
  it('contains Tab focus and restores the call trigger after closing', async () => {
    await act(async () => root.render(<TestHarness />))

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')
    const first = host.querySelector<HTMLButtonElement>('[data-focus-first]')
    const controls = host.querySelectorAll<HTMLButtonElement>('button')
    const last = controls[controls.length - 1]
    const close = host.querySelector<HTMLButtonElement>('[data-call-close]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe('Cuộc gọi với Aster')
    expect(document.activeElement).toBe(dialog)
    expect(first).not.toBeNull()
    expect(close).not.toBeNull()
    makeVisible(first!)
    makeVisible(controls[1])
    makeVisible(last)

    last.focus()
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    await act(async () => { last.dispatchEvent(forward) })
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    await act(async () => { first!.dispatchEvent(backward) })
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    callTrigger.focus()
    expect(document.activeElement).toBe(first)

    await act(async () => {
      close!.click()
      await Promise.resolve()
    })
    expect(mocks.leaveCall).toHaveBeenCalledOnce()
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(callTrigger)
  })
})
