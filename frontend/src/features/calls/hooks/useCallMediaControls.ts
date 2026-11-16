import { type Dispatch, type SetStateAction } from 'react'
import { type Room } from 'livekit-client'
import { type CallMediaType } from '../lib/calls'
import { isDesktopBuild } from '../../../platform/desktop'
import { requireDesktopMedia } from '../../../platform/desktopMedia'
import { friendlyCallError } from '../lib/callErrors'

type MediaControlsArgs = {
  room?: Room
  mediaType: CallMediaType
  ending: boolean
  permissionRetrying: boolean
  micOn: boolean
  cameraOn: boolean
  screenOn: boolean
  soundOn: boolean
  setPermissionRetrying: Dispatch<SetStateAction<boolean>>
  setMicOn: Dispatch<SetStateAction<boolean>>
  setCameraOn: Dispatch<SetStateAction<boolean>>
  setScreenOn: Dispatch<SetStateAction<boolean>>
  setSoundOn: Dispatch<SetStateAction<boolean>>
  setMediaPermissionError: Dispatch<SetStateAction<string>>
  onError: (message: string) => void
}

export function useCallMediaControls({ room, mediaType, ending, permissionRetrying, micOn, cameraOn, screenOn, soundOn, setPermissionRetrying, setMicOn, setCameraOn, setScreenOn, setSoundOn, setMediaPermissionError, onError }: MediaControlsArgs) {
  async function requestCallMediaPermission() {
    if (!room || permissionRetrying || ending) return
    setPermissionRetrying(true)
    try {
      if (!micOn) {
        await requireDesktopMedia('microphone')
        if (room.state !== 'connected') return
        await room.localParticipant.setMicrophoneEnabled(true)
        if (room.state !== 'connected') return
        setMicOn(true)
      }
      if (mediaType === 'video' && !cameraOn) {
        await requireDesktopMedia('camera')
        if (room.state !== 'connected') return
        await room.localParticipant.setCameraEnabled(true)
        if (room.state !== 'connected') return
        setCameraOn(true)
      }
      setMediaPermissionError('')
    } catch (err) {
      setMediaPermissionError(friendlyCallError(err))
    } finally {
      setPermissionRetrying(false)
    }
  }

  async function toggleMic() {
    if (!room || ending || permissionRetrying) return
    setPermissionRetrying(true)
    try {
      const next = !micOn
      if (next) await requireDesktopMedia('microphone')
      if (next && room.state !== 'connected') return
      await room.localParticipant.setMicrophoneEnabled(next)
      if (room.state !== 'connected') return
      setMicOn(next)
      setMediaPermissionError('')
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
    finally { setPermissionRetrying(false) }
  }

  async function toggleCamera() {
    if (!room || ending || permissionRetrying) return
    setPermissionRetrying(true)
    try {
      const next = !cameraOn
      if (next) await requireDesktopMedia('camera')
      if (next && room.state !== 'connected') return
      await room.localParticipant.setCameraEnabled(next)
      if (room.state !== 'connected') return
      setCameraOn(next)
      setMediaPermissionError('')
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
    finally { setPermissionRetrying(false) }
  }

  async function toggleScreen() {
    if (!room || ending) return
    try {
      const next = !screenOn
      // Desktop grants video only; system audio is not implicitly shared.
      await room.localParticipant.setScreenShareEnabled(next, isDesktopBuild ? { audio: false } : undefined)
      if (room.state !== 'connected') return
      setScreenOn(room.localParticipant.isScreenShareEnabled)
    } catch (err) { onError(friendlyCallError(err)) }
  }

  async function toggleSound() {
    if (!room) return
    const next = !soundOn
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        const element = publication.track?.attachedElements?.[0] as HTMLMediaElement | undefined
        if (element) element.muted = !next
      }
    }
    if (next) {
      try { await room.startAudio() } catch { onError('Trình duyệt đang chặn phát âm thanh. Hãy chạm lại nút loa.') }
    }
    setSoundOn(next)
  }

  return { requestCallMediaPermission, toggleMic, toggleCamera, toggleScreen, toggleSound }
}
