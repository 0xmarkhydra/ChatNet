import { useEffect, useRef } from 'react'
import { Track, type LocalTrack, type Participant, type RemoteTrack, type TrackPublication, type Room } from 'livekit-client'

export function ParticipantTile({ participant, local }: { participant: Participant; local: boolean }) {
  const camera = participant.getTrackPublication(Track.Source.Camera)
  const screen = participant.getTrackPublication(Track.Source.ScreenShare)
  const videoPublication = screen?.track ? screen : camera
  const muted = !videoPublication?.track || videoPublication.isMuted
  return (
    <div className={`call-participant-tile ${screen?.track ? 'screen-tile' : ''} ${participant.isSpeaking ? 'is-speaking' : ''}`}>
      {!muted && videoPublication?.track ? (
        <VideoTrackView publication={videoPublication} mirror={local && videoPublication.source === Track.Source.Camera} />
      ) : (
        <div className="call-avatar-fallback"><span>{identityLabel(participant.identity)}</span></div>
      )}
      <div className="call-participant-label">
        <span>{local ? 'Bạn' : identityLabel(participant.identity)}</span>
        {participant.isSpeaking && <i className="call-speaking-dot" />}
      </div>
    </div>
  )
}

function VideoTrackView({ publication, mirror }: { publication: TrackPublication; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    const track = publication.track as LocalTrack | RemoteTrack | undefined
    if (!element || !track) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [publication.track])
  return <video ref={ref} autoPlay playsInline muted={mirror} className={mirror ? 'mirror' : ''} />
}

export function RemoteAudioSinks({ room, muted, volume, revision }: { room: Room; muted: boolean; volume: number; revision: number }) {
  revision
  const tracks = Array.from(room.remoteParticipants.values()).flatMap((participant) =>
    Array.from(participant.audioTrackPublications.values()).filter((publication) => publication.track),
  )
  return <>{tracks.map((publication) => <AudioTrackSink key={publication.trackSid} publication={publication} muted={muted} volume={volume} />)}</>
}

function AudioTrackSink({ publication, muted, volume }: { publication: TrackPublication; muted: boolean; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
  useEffect(() => {
    const element = ref.current
    const track = publication.track as RemoteTrack | undefined
    if (!element || !track) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [publication.track])
  return <audio ref={ref} autoPlay muted={muted} />
}

export function identityLabel(identity: string) {
  const id = identity.startsWith('u_') ? identity.slice(2) : identity
  return `U${id}`
}

