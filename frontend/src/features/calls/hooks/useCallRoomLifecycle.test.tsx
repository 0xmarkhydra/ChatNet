// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CallSession, CallRequest } from '../lib/calls'
import { useCallRoomLifecycle } from './useCallRoomLifecycle'

const { handlers, disconnect, joinCall } = vi.hoisted(() => ({
  handlers: new Map<string, () => void>(),
  disconnect: vi.fn(async () => {}),
  joinCall: vi.fn(async () => ({ serverUrl: 'wss://example.test', token: 'test' })),
}))

vi.mock('livekit-client', () => ({
  isE2EESupported: () => true,
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed', TrackUnsubscribed: 'trackUnsubscribed',
    ParticipantConnected: 'participantConnected', ParticipantDisconnected: 'participantDisconnected',
    LocalTrackPublished: 'localTrackPublished', LocalTrackUnpublished: 'localTrackUnpublished',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    Reconnecting: 'reconnecting', Reconnected: 'reconnected', Disconnected: 'disconnected',
  },
  ExternalE2EEKeyProvider: class { async setKey() {} },
  Room: class {
    localParticipant = { isMicrophoneEnabled: false, isCameraEnabled: false, isScreenShareEnabled: false }
    on(event: string, callback: () => void) { handlers.set(event, callback) }
    async setE2EEEnabled() {}
    async connect() {}
    disconnect = disconnect
    async startAudio() {}
  },
}))
vi.mock('../lib/calls', () => ({
  joinCall,
  publishE2EEPublicKey: async () => {},
  endCall: async () => {},
  leaveCall: async () => {},
}))
vi.mock('../lib/callCrypto', () => ({
  generateEphemeralCallKeyPair: async () => ({ publicKey: 'test' }),
  generateKeyGeneration: () => 'generation',
  generateMediaKey: () => new Uint8Array(32),
  mediaKeyBuffer: () => new ArrayBuffer(32),
}))
vi.mock('../lib/callE2EEKeySync', () => ({
  createCallKeySynchronizers: () => ({
    syncHostKeys: async () => {},
    syncParticipantKey: async () => {},
  }),
}))

describe('call room lifecycle cleanup', () => {
  afterEach(() => {
    handlers.clear()
    disconnect.mockClear()
    joinCall.mockClear()
  })

  function mountLifecycle() {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('Worker', class { terminate() {} })
    vi.stubGlobal('isSecureContext', true)
    const root = createRoot(document.createElement('div'))
    const call = { id: 'call-78', createdBy: 1, mediaType: 'audio', conversationId: 7, status: 'active', createdAt: '' } as CallSession
    const noop = vi.fn()
    const request = noop as unknown as CallRequest

    function Probe({ autoPublish, onClosed }: { autoPublish: boolean; onClosed: () => void }) {
      useCallRoomLifecycle({
        call: { ...call }, request, userId: 1, autoPublish, onError: noop, onClosed,
        setPhase: noop, setDetail: noop, setRuntime: noop, setRevision: noop,
        setMicOn: noop, setCameraOn: noop, setScreenOn: noop, setMediaPermissionError: noop,
      })
      return null
    }

    return {
      render: (autoPublish: boolean, onClosed: () => void) =>
        act(async () => root.render(<Probe autoPublish={autoPublish} onClosed={onClosed} />)),
      unmount: async () => {
        await act(async () => root.unmount())
        vi.unstubAllGlobals()
      },
    }
  }

  it('does not rejoin a live call when onClosed or autoPublish changes', async () => {
    const lifecycle = mountLifecycle()
    try {
      await lifecycle.render(false, vi.fn())
      await lifecycle.render(false, vi.fn())
      await lifecycle.render(true, vi.fn())
      expect(joinCall).toHaveBeenCalledTimes(1)
      expect(disconnect).not.toHaveBeenCalled()
    } finally {
      await lifecycle.unmount()
    }
  })

  it('closes through the latest onClosed when a pending join fails', async () => {
    let fail: ((error: Error) => void) | undefined
    joinCall.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    const first = vi.fn()
    const latest = vi.fn()
    const lifecycle = mountLifecycle()
    try {
      await lifecycle.render(false, first)
      await lifecycle.render(false, latest)
      await act(async () => fail!(new Error('join failed')))
      expect(joinCall).toHaveBeenCalledTimes(1)
      expect(latest).toHaveBeenCalledTimes(1)
      expect(first).not.toHaveBeenCalled()
    } finally {
      await lifecycle.unmount()
    }
  })

  it('ignores late LiveKit reconnect events after cleanup', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const oldWorker = globalThis.Worker
    const workerTerminate = vi.fn()
    vi.stubGlobal('Worker', class { terminate = workerTerminate })
    vi.stubGlobal('isSecureContext', true)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const setPhase = vi.fn()
    const setDetail = vi.fn()
    const setRuntime = vi.fn()
    const noop = vi.fn()

    function Probe() {
      useCallRoomLifecycle({
        call: { id: 'call-77', createdBy: 1, mediaType: 'audio', conversationId: 7, status: 'active', createdAt: '' } as CallSession,
        request: noop as unknown as CallRequest,
        userId: 1,
        autoPublish: false,
        onError: noop,
        onClosed: noop,
        setPhase, setDetail, setRuntime,
        setRevision: noop, setMicOn: noop, setCameraOn: noop, setScreenOn: noop,
        setMediaPermissionError: noop,
      })
      useEffect(() => {}, [])
      return null
    }

    try {
      await act(async () => root.render(<Probe />))
      expect(handlers.has('reconnecting')).toBe(true)
      await act(async () => root.unmount())
      setPhase.mockClear()
      setDetail.mockClear()
      handlers.get('reconnecting')?.()
      handlers.get('reconnected')?.()
      expect(setPhase).not.toHaveBeenCalled()
      expect(setDetail).not.toHaveBeenCalled()
      expect(workerTerminate).toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
      host.remove()
      vi.unstubAllGlobals()
      globalThis.Worker = oldWorker
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
