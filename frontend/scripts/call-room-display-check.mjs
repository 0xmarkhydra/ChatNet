import assert from 'node:assert/strict'
import { deriveCallRoomDisplay } from '../src/features/calls/lib/callRoomDisplay.ts'

const publication = (sid, muted = false, hasTrack = true) => ({
  trackSid: sid,
  isMuted: muted,
  track: hasTrack ? { mediaStreamTrack: { id: sid } } : undefined,
})
const participant = (identity, publications = []) => ({
  identity,
  audioTrackPublications: new Map(publications.map((item) => [item.trackSid, item])),
})
const local = participant('u_1', [publication('local')])
const remoteA = participant('u_2', [publication('active-a'), publication('muted-a', true)])
const remoteB = participant('u_3', [publication('inactive-b', false, false), publication('active-b')])
const captions = [
  { id: 'one', speakerId: 'u_2', original: 'Hello', translated: 'Xin chào', updatedAt: 1 },
  { id: 'two', speakerId: 'u_3', original: 'Bye', translated: '   ', updatedAt: 2 },
]
const consent = { u_2: true, u_3: false }
const result = deriveCallRoomDisplay([local, remoteA, remoteB], local, captions, consent, 'connected')
assert.equal(result.remoteTrackKey, 'u_2:active-a|u_3:active-b')
assert.equal(result.remoteConsentKey, JSON.stringify(consent))
assert.equal(result.latestCaption?.id, 'one')
assert.equal(result.waitingConsentCount, 1)
assert.equal(result.statusLabel, 'Bảo mật')
assert.equal(deriveCallRoomDisplay([], undefined, [], {}, 'error').statusLabel, 'Đã ngắt')
assert.equal(deriveCallRoomDisplay([local], local, [], {}, 'reconnecting').statusLabel, 'Đang nối lại')
assert.equal(deriveCallRoomDisplay([local], local, [], {}, 'securing').statusLabel, 'Đang kết nối')
assert.equal(deriveCallRoomDisplay([local], local, [], {}, 'securing').waitingConsentCount, 0)
console.log('PASS: call participant/track display, captions, consent count, connection labels')
