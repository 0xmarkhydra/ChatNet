// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import type { Room } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import IncomingCallDialog from './IncomingCallDialog'
import { useCallMediaControls } from '../hooks/useCallMediaControls'
import type { CallMediaType, CallView } from '../lib/calls'

const requestDevice = vi.hoisted(() => vi.fn<(kind: 'microphone' | 'camera') => Promise<void>>())
vi.mock('../../../platform/desktopMedia', () => ({ requireDesktopMedia: requestDevice }))
vi.mock('../../../platform/desktop', () => ({ isDesktopBuild: true }))

function incomingDialog(mediaType: CallMediaType, busy = false) {
  const incoming: CallView = {
    id: 'qa-call', conversationId: 1, createdBy: 2, mediaType, status: 'ringing',
    createdAt: '2026-11-18T00:00:00Z', role: 'participant', joined: false, incoming: true,
    canEnd: false, e2eeReady: true, configured: true,
  }
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(<IncomingCallDialog incoming={incoming} incomingName="Người gọi thử"
    isGroup={false} busy={busy} incomingPermission="" rejectIncoming={vi.fn()}
    acceptIncoming={vi.fn()} checkIncomingPermission={vi.fn()} />)
  return container
}

function controlsFixture(options: { mediaType?: CallMediaType; ending?: boolean; soundOn?: boolean } = {}) {
  requestDevice.mockReset().mockResolvedValue(undefined)
  const primaryAudio = document.createElement('audio')
  const startAudio = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const participant = {
    setMicrophoneEnabled: vi.fn(async (_enabled: boolean) => {}),
    setCameraEnabled: vi.fn(async (_enabled: boolean) => {}),
    setScreenShareEnabled: vi.fn(async (_enabled: boolean) => {}),
    isScreenShareEnabled: false,
  }
  const room = {
    state: 'connected', localParticipant: participant, startAudio,
    remoteParticipants: new Map([[1, { audioTrackPublications: new Map([[1, { track: { attachedElements: [primaryAudio] } }]]) }]]),
  }
  const setPermissionRetrying = vi.fn()
  const setMicOn = vi.fn()
  const setCameraOn = vi.fn()
  const setScreenOn = vi.fn()
  const setSoundOn = vi.fn()
  const setMediaPermissionError = vi.fn()
  const onError = vi.fn()
  const probe: { controls?: ReturnType<typeof useCallMediaControls> } = {}
  function Probe() {
    probe.controls = useCallMediaControls({
      room: room as unknown as Room, mediaType: options.mediaType ?? 'audio', ending: options.ending ?? false,
      permissionRetrying: false, micOn: false, cameraOn: false, screenOn: false, soundOn: options.soundOn ?? true,
      setPermissionRetrying, setMicOn, setCameraOn, setScreenOn, setSoundOn, setMediaPermissionError, onError,
    })
    return null
  }
  renderToStaticMarkup(<Probe />)
  if (!probe.controls) throw new Error('Unable to mount call media controls')
  return { controls: probe.controls, participant, primaryAudio, startAudio, setPermissionRetrying, setMicOn, setCameraOn,
    setScreenOn, setSoundOn, setMediaPermissionError, onError }
}

describe('incoming call controls', () => {
  it('provides labeled response controls without a camera action for an audio call', () => {
    const incoming = incomingDialog('audio')
    expect(incoming.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Cuộc gọi đến')
    expect(Array.from(incoming.querySelectorAll('button'), (button) => button.textContent?.trim()))
      .toEqual(['Từ chối', 'Trả lời', 'Microphone · Kiểm tra quyền'])
  })

  it('does not tell someone answering an audio-only call that a camera is required', () => {
    expect(incomingDialog('audio').querySelector('.incoming-call-info-box p')?.textContent).not.toMatch(/camera/i)
  })

  it('disables all response and media actions while the video call response is pending', () => {
    const buttons = Array.from(incomingDialog('video', true).querySelectorAll('button'))
    expect(buttons.map((button) => button.textContent?.trim())).toContain('Camera · Kiểm tra quyền')
    expect(buttons.every((button) => button.disabled)).toBe(true)
  })
})

describe('call media edge behavior', () => {
  it('requests only the microphone when retrying permission for an audio call', async () => {
    const f = controlsFixture()
    await f.controls.requestCallMediaPermission()
    expect(requestDevice.mock.calls).toEqual([['microphone']])
    expect(f.participant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    expect(f.participant.setCameraEnabled).not.toHaveBeenCalled()
    expect(f.setPermissionRetrying.mock.calls).toEqual([[true], [false]])
  })

  it('does not publish a camera stream when the microphone succeeded but the camera was refused', async () => {
    const f = controlsFixture({ mediaType: 'video' })
    requestDevice.mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
    await f.controls.requestCallMediaPermission()
    expect(requestDevice.mock.calls).toEqual([['microphone'], ['camera']])
    expect(f.setMicOn).toHaveBeenCalledWith(true)
    expect(f.participant.setCameraEnabled).not.toHaveBeenCalled()
    expect(f.setCameraOn).not.toHaveBeenCalled()
    expect(f.setMediaPermissionError).toHaveBeenCalledWith(expect.stringContaining('bị từ chối'))
    expect(f.setPermissionRetrying).toHaveBeenLastCalledWith(false)
  })

  it('never starts enabling media while leaving the call', async () => {
    const f = controlsFixture({ ending: true })
    await f.controls.requestCallMediaPermission()
    await f.controls.toggleMic()
    await f.controls.toggleCamera()
    await f.controls.toggleScreen()
    expect(requestDevice).not.toHaveBeenCalled()
    expect(f.participant.setMicrophoneEnabled).not.toHaveBeenCalled()
    expect(f.participant.setCameraEnabled).not.toHaveBeenCalled()
    expect(f.participant.setScreenShareEnabled).not.toHaveBeenCalled()
  })

  it('requests video only on desktop and uses the screen-share state returned by the room', async () => {
    const f = controlsFixture()
    await f.controls.toggleScreen()
    expect(f.participant.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: false })
    expect(f.setScreenOn).toHaveBeenCalledWith(false)
  })

  it('mutes the active remote audio sink without asking the browser to start playback', async () => {
    const f = controlsFixture()
    await f.controls.toggleSound()
    expect(f.primaryAudio.muted).toBe(true)
    expect(f.startAudio).not.toHaveBeenCalled()
    expect(f.setSoundOn).toHaveBeenCalledWith(false)
  })

  it('retains the speaker-off state if the browser blocks playback', async () => {
    const f = controlsFixture({ soundOn: false })
    f.primaryAudio.muted = true
    f.startAudio.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'))
    await f.controls.toggleSound()
    expect(f.onError).toHaveBeenCalledWith(expect.stringContaining('chặn phát âm thanh'))
    expect(f.setSoundOn).not.toHaveBeenCalledWith(true)
    expect(f.primaryAudio.muted).toBe(true)
  })
})