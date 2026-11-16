// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Room } from 'livekit-client'
import { useCallMediaControls } from './useCallMediaControls'

vi.mock('../../../platform/desktopMedia', () => ({
  requireDesktopMedia: async () => {},
}))

describe('call media controls', () => {
  it('does not resurrect enabled mic state after disconnect during permission request', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const setMicOn = vi.fn()
    const setRetry = vi.fn()
    const noop = vi.fn()
    let finishEnable: (() => void) | undefined
    const room = {
      state: 'connected',
      localParticipant: {
        setMicrophoneEnabled: vi.fn(() => new Promise<void>(resolve => { finishEnable = resolve })),
      },
    } as unknown as Room
    let toggleMic: (() => Promise<void>) | undefined

    function Probe() {
      const controls = useCallMediaControls({
        room, mediaType: 'audio', ending: false, permissionRetrying: false,
        micOn: false, cameraOn: false, screenOn: false, soundOn: true,
        setPermissionRetrying: setRetry, setMicOn,
        setCameraOn: noop, setScreenOn: noop, setSoundOn: noop,
        setMediaPermissionError: noop, onError: noop,
      })
      useLayoutEffect(() => { toggleMic = controls.toggleMic })
      return null
    }

    try {
      await act(async () => root.render(<Probe />))
      let pending: Promise<void> | undefined
      await act(async () => { pending = toggleMic?.() })
      expect(finishEnable).toBeTypeOf('function')
      ;(room as unknown as { state: string }).state = 'disconnected'
      await act(async () => { finishEnable?.(); await pending })
      expect(setMicOn).not.toHaveBeenCalled()
      expect(setRetry).toHaveBeenLastCalledWith(false)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
