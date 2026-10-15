import assert from 'node:assert/strict'
import { IncomingMessageSound, MESSAGE_SOUND_SETTING_KEY, persistMessageSoundEnabled, readMessageSoundEnabled } from '../src/incomingSound.ts'

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
sound.unlock()
assert.equal(resumed, 1)
assert.equal(sound.onIncoming(incoming(2), 1, true), true)
assert.equal(playing, 2, 'soft two-tone notification is generated once')
assert.equal(sound.onIncoming(incoming(2), 1, true), false, 'replayed event must be silent')
assert.equal(sound.onIncoming({ ...incoming(3), senderId: 1 }, 1, true), false, 'own sends are silent')
assert.equal(sound.onIncoming(incoming(4), 1, true), false, 'bursts are throttled')
time += 1200
assert.equal(sound.onIncoming(incoming(5), 1, false), false, 'mute disables sound')
isVisible = false
assert.equal(sound.onIncoming(incoming(6), 1, true), false, 'background tab yields to push notifications')
isVisible = true
assert.equal(sound.onIncoming({ ...incoming(7), createdAt: new Date(time - 240_000).toISOString() }, 1, true), false,
  'old messages replayed after an offline period must not beep')
assert.equal(sound.onIncoming(incoming(8), 1, true), true, 'new foreground message rings after throttle')
assert.equal(playing, 4)
assert.equal(await sound.preview(), true, 'user initiated sample must always be available')
assert.equal(playing, 6)
sound.clearSeen()
time += 1200
assert.equal(sound.onIncoming(incoming(2), 1, true), true, 'logout resets message IDs for next session')
sound.dispose()

console.log('PASS: preferences, unlock, SSE dedup, self-message, throttle, mute, background, stale events and preview')
