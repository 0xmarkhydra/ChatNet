import assert from 'node:assert/strict'
import { IncomingMessageSound, MESSAGE_SOUND_SETTING_KEY, persistMessageSoundEnabled, readMessageSoundEnabled } from '../src/features/notifications/lib/incomingSound.ts'

const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}

assert.equal(readMessageSoundEnabled(), true, 'sound defaults to on for new installs')
persistMessageSoundEnabled(false)
assert.equal(storage.get(MESSAGE_SOUND_SETTING_KEY), 'false')
assert.equal(readMessageSoundEnabled(), false, 'muted choice must survive reload')
persistMessageSoundEnabled(true)
assert.equal(readMessageSoundEnabled(), true)

let time = Date.parse('2026-10-15T09:00:00Z')
let isVisible = true
let playing = 0
let resumed = 0
class MockAudioContext {
  state = 'suspended'
  currentTime = 5
  destination = {}
  resume() { resumed++; this.state = 'running'; return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
  createOscillator() {
    return {
      frequency: { setValueAtTime() {} }, type: 'sine',
      connect() {}, disconnect() {},
      start() { playing++ }, stop() {}, onended: null,
    }
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {}, exponentialRampToValueAtTime() {},
      },
      connect() {}, disconnect() {},
    }
  }
}
const sound = new IncomingMessageSound(() => new MockAudioContext(), () => time, () => isVisible)
const incoming = id => ({ id, senderId: 2, createdAt: new Date(time).toISOString() })
assert.equal(sound.onIncoming(incoming(1), 1, true), false, 'autoplay forbidden before interaction')
assert.equal(sound.getDiagnostic().result, 'audio-not-initialized', 'report missing browser audio unlock')
sound.unlock()
assert.equal(resumed, 1)
assert.equal(sound.onIncoming(incoming(2), 1, true), true)
assert.equal(playing, 2, 'soft two-tone notification is generated once')
assert.equal(sound.onIncoming(incoming(2), 1, true), false, 'replayed event must be silent')
assert.equal(sound.onIncoming({ ...incoming(3), senderId: 1 }, 1, true), false, 'own sends are silent')
assert.equal(sound.getDiagnostic().result, 'own-message', 'explain why testing from the same account is silent')
assert.equal(sound.onIncoming(incoming(4), 1, true), false, 'bursts are throttled')
time += 1200
assert.equal(sound.onIncoming(incoming(5), 1, false), false, 'mute disables sound')
assert.equal(sound.getDiagnostic().result, 'disabled')
isVisible = false
assert.equal(sound.onIncoming(incoming(6), 1, true), false, 'background tab yields to push notifications')
isVisible = true
assert.equal(sound.onIncoming({ ...incoming(7), createdAt: new Date(time - 240_000).toISOString() }, 1, true), true,
  'live SSE must ring despite a server/device clock mismatch')
assert.equal(sound.getDiagnostic().result, 'played')
time += 1200
assert.equal(sound.onIncoming({ ...incoming(8), createdAt: new Date(time + 4 * 60 * 60_000).toISOString() }, 1, true), true,
  'future-skewed timestamps must not mute a live message')
assert.equal(playing, 6)
assert.equal(await sound.preview(), true, 'user initiated sample must always be available')
assert.equal(playing, 8)
sound.clearSeen()
time += 1200
assert.equal(sound.onIncoming(incoming(2), 1, true), true, 'logout resets message IDs for next session')
sound.dispose()

// The browser may chime in a background tab after a trusted interaction.
// Desktop separately gates local audio by window focus and uses native notifications instead.
let focused = false
globalThis.document = { visibilityState: 'hidden', hasFocus: () => focused }
const backgroundSound = new IncomingMessageSound(() => new MockAudioContext(), () => time)
backgroundSound.unlock()
assert.equal(backgroundSound.onIncoming(incoming(40), 1, true), true, 'unlocked background browser tab plays sound')
focused = true
globalThis.document.visibilityState = 'visible'
time += 1200
assert.equal(backgroundSound.onIncoming(incoming(41), 1, true), true, 'focused tab plays incoming sound')
backgroundSound.dispose()

// Chromium may suspend an already-unlocked AudioContext when a tab goes to the background.
class SuspendedAudioContext extends MockAudioContext {
  releases = []
  resume() {
    resumed++
    return new Promise(resolve => {
      this.releases.push(() => { this.state = 'running'; resolve() })
    })
  }
  release() {
    for (const fn of this.releases.splice(0)) fn()
  }
}
let suspendedContext
const recoverySound = new IncomingMessageSound(() => {
  suspendedContext = new SuspendedAudioContext()
  return suspendedContext
}, () => time, () => true)
recoverySound.unlock()
const playedBeforeRecovery = playing
time += 1200
assert.equal(recoverySound.onIncoming(incoming(50), 1, true), false, 'pending resume cannot play immediately')
assert.equal(playing, playedBeforeRecovery, 'no tone while AudioContext is suspended')
suspendedContext.release()
await Promise.resolve()
assert.equal(playing, playedBeforeRecovery + 2, 'fresh message plays as soon as suspended audio recovers')

// Do not ring late after the browser wakes up from a long idle interval.
suspendedContext.state = 'suspended'
time += 1200
assert.equal(recoverySound.onIncoming(incoming(51), 1, true), false)
time += 6000
suspendedContext.release()
await Promise.resolve()
assert.equal(playing, playedBeforeRecovery + 2, 'late resume must not ring an old message')

// Logout cancels an in-flight resume from a previous session.
suspendedContext.state = 'suspended'
time += 1200
assert.equal(recoverySound.onIncoming(incoming(52), 1, true), false)
recoverySound.clearSeen()
suspendedContext.release()
await Promise.resolve()
assert.equal(playing, playedBeforeRecovery + 2, 'cleared session must not play delayed audio')
recoverySound.dispose()

// Local wall-clock changes must not alter the notification rate limit.
const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance')
const originalDateNow = Date.now
let elapsed = 1000
Object.defineProperty(globalThis, 'performance', {
  configurable: true, value: { now: () => elapsed },
})
try {
  const monotonicSound = new IncomingMessageSound(() => new MockAudioContext(), undefined, () => true)
  monotonicSound.unlock()
  assert.equal(monotonicSound.onIncoming({ id: 60, senderId: 2, createdAt: '1970-01-01T00:00:00Z' }, 1, true), true)
  Date.now = () => 9_000_000_000_000
  elapsed += 100
  assert.equal(monotonicSound.onIncoming({ id: 61, senderId: 2 }, 1, true), false,
    'changing the system clock does not bypass the short sound throttle')
  elapsed += 1000
  Date.now = () => 1
  assert.equal(monotonicSound.onIncoming({ id: 62, senderId: 2 }, 1, true), true,
    'the next distinct message rings using monotonic elapsed time, regardless of wall-clock changes')
  monotonicSound.dispose()
} finally {
  Date.now = originalDateNow
  Object.defineProperty(globalThis, 'performance', originalPerformance)
}

console.log('PASS: preferences, unlock, self-message, throttle, mute, background tabs, suspended-context recovery, wall-clock independence, session isolation and preview')
