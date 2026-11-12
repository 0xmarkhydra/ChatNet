import assert from 'node:assert/strict'
import { formatDuration, latestCallDuration } from '../src/features/calls/utils/call-history.ts'

const connected = {
  id: 'successful', conversationId: 1, createdBy: 1, mediaType: 'audio',
  status: 'ended', createdAt: '2026-11-09T09:00:00Z',
  startedAt: '2026-11-09T09:00:00Z', endedAt: '2026-11-09T09:01:15Z',
  joined: true, declined: false, isGroup: false, participantCount: 2,
}
const newer = (overrides) => ({
  ...connected, id: 'newer', createdAt: '2026-11-09T10:00:00Z', ...overrides,
})
const cancelled = newer({ status: 'cancelled', joined: false, startedAt: undefined })
const missedGroup = newer({ joined: false, isGroup: true, participantCount: 3 })
const declined = newer({ declined: true, joined: false })
const malformed = newer({ startedAt: 'not-a-date' })
const backward = newer({ endedAt: '2026-11-09T08:00:00Z' })

assert.equal(latestCallDuration([cancelled, connected]), '00:00', 'missed newest call has zero duration')
assert.equal(latestCallDuration([missedGroup, connected]), '00:00', 'a group call the user missed has zero duration')
assert.equal(latestCallDuration([declined, connected]), '00:00', 'declined newest call has zero duration')
assert.equal(latestCallDuration([connected, cancelled]), '01:15', 'connected newest call retains its duration')
assert.equal(latestCallDuration([malformed, backward, connected]), '00:00', 'invalid newest call duration is zero')
assert.equal(latestCallDuration([cancelled, missedGroup, declined]), '00:00', 'no connected calls')
assert.equal(latestCallDuration([]), '00:00', 'empty history')
assert.equal(formatDuration(cancelled), '00:00', 'unanswered call details show zero duration')
assert.equal(formatDuration(declined), '00:00', 'declined call details show zero duration')
assert.equal(formatDuration(missedGroup), '00:00', 'missed group call details show zero duration')
assert.equal(formatDuration(connected), '01:15')
assert.equal(formatDuration(newer({ endedAt: connected.startedAt })), '00:00')
assert.equal(formatDuration(newer({ endedAt: '2026-11-09T10:01:01Z', startedAt: '2026-11-09T09:00:00Z' })), '61:01')
console.log('PASS call history duration: missed/declined/cancelled calls show 00:00 in summary and details')
