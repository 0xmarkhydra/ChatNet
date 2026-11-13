// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Room } from 'livekit-client'
import type { InterpreterSession } from '../lib/callMediaInterpreter'
import type { CallRequest } from '../lib/calls'
import { useCallInterpreterSessions } from './useCallInterpreterSessions'

const { starts } = vi.hoisted(() => ({
  starts: [] as Array<{ callId: string; resolve: (session: { stop: () => void }) => void }>,
}))
vi.mock('../lib/callMediaInterpreter', () => ({
  startCallMediaInterpreter: ({ callId }: { callId: string }) =>
    new Promise((resolve) => { starts.push({ callId, resolve }) }),
}))

describe('call interpreter session isolation', () => {
  it('keeps the new call pending when an old interpreter resolves after cleanup', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    starts.length = 0
    const pending = { current: new Set<string>() }
    const interpreters = { current: new Map<string, InterpreterSession>() }
    const track = { id: 'audio' }
    const room = {
      remoteParticipants: new Map([['speaker', {
        identity: 'speaker',
        audioTrackPublications: new Map([['mic', { track: { mediaStreamTrack: track }, isMuted: false }]]),
      }]]),
    } as unknown as Room
    const noop = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const stopOld = vi.fn()
    const stopNew = vi.fn()

    function Probe({ callId }: { callId: string }) {
      useCallInterpreterSessions({
        room, phase: 'connected', translationOn: true, callId, callTargetLanguage: 'vi',
        apiBase: '/api', request: noop as unknown as CallRequest,
        remoteTrackKey: 'speaker:audio', remoteConsentKey: '{"speaker":true}',
        translationRetryEpoch: 0, interpreters, interpreterPending: pending,
        setCaptions: noop, setTranslationError: noop, setTranslatingIds: noop,
      })
      return null
    }

    try {
      await act(async () => root.render(<Probe callId="A" />))
      expect(starts.map(start => start.callId)).toEqual(['A'])
      await act(async () => root.render(<Probe callId="B" />))
      expect(starts.map(start => start.callId)).toEqual(['A', 'B'])
      expect(pending.current.has('speaker')).toBe(true)
      await act(async () => starts[0].resolve({ stop: stopOld }))
      expect(stopOld).toHaveBeenCalledOnce()
      expect(pending.current.has('speaker')).toBe(true)
      await act(async () => starts[1].resolve({ stop: stopNew }))
      expect(pending.current.has('speaker')).toBe(false)
      expect(interpreters.current.has('speaker')).toBe(true)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      starts.length = 0
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
