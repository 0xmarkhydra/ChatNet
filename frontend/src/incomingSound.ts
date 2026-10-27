/** Browser-local incoming message sound. Never requires a backend credential.
 * The AudioContext is created/resumed only in a trusted user gesture, respecting
 * iOS Safari/PWA and Chrome autoplay restrictions. Background sound is left to
 * operating-system push notifications, not to a suspended web page.
 */
export const MESSAGE_SOUND_SETTING_KEY = 'chatnet-message-sound-enabled-v1'

export function readMessageSoundEnabled(): boolean {
  try { return localStorage.getItem(MESSAGE_SOUND_SETTING_KEY) !== 'false' }
  catch { return true }
}

export function persistMessageSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(MESSAGE_SOUND_SETTING_KEY, enabled ? 'true' : 'false') }
  catch { /* Private browsing may deny storage. Current-tab setting still works. */ }
}

export type IncomingSoundEvent = {
  id: number
  senderId: number
  createdAt?: string
}

type AudioContextFactory = () => AudioContext | null

export class IncomingMessageSound {
  private context: AudioContext | null = null
  private readonly seen = new Set<number>()
  private readonly seenOrder: number[] = []
  private lastPlayedAt = -Infinity

  private readonly createContext: AudioContextFactory
  private readonly now: () => number
  private readonly visible: () => boolean

  constructor(
    createContext: AudioContextFactory = () => {
      if (typeof window === 'undefined') return null
      const WebkitAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const AudioConstructor = window.AudioContext || WebkitAudioContext
      return AudioConstructor ? new AudioConstructor() : null
    },
    now: () => number = Date.now,
    visible: () => boolean =
      () => typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus(),
  ) {
    this.createContext = createContext
    this.now = now
    this.visible = visible
  }

  /** Run synchronously from a pointer/key interaction, NOT inside SSE callbacks. */
  unlock() {
    try {
      if (!this.context || this.context.state === 'closed') this.context = this.createContext()
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => undefined)
    } catch { /* Unsupported browser: notifications remain visual only. */ }
  }

  /** Called only when the user clicks Test / enables the local sound setting. */
  async preview(): Promise<boolean> {
    this.unlock()
    if (this.context?.state === 'suspended') {
      try { await this.context.resume() } catch { return false }
    }
    return this.playTone()
  }

  onIncoming(event: IncomingSoundEvent, myUserId: number, enabled: boolean): boolean {
    if (!Number.isSafeInteger(event.id) || event.id <= 0 || event.senderId === myUserId) return false
    if (this.seen.has(event.id)) return false
    this.seen.add(event.id)
    this.seenOrder.push(event.id)
    if (this.seenOrder.length > 512) this.seen.delete(this.seenOrder.shift()!)

    const now = this.now()
    const sentAt = event.createdAt ? Date.parse(event.createdAt) : NaN
    // Avoid a noisy reconnect/offline replay. Future timestamps are not trusted.
    if (Number.isFinite(sentAt) && (now - sentAt > 120_000 || sentAt - now > 60_000)) return false
    if (!enabled || !this.visible() || now - this.lastPlayedAt < 900) return false
    if (!this.playTone()) return false
    this.lastPlayedAt = now
    return true
  }

  clearSeen() {
    this.seen.clear()
    this.seenOrder.length = 0
    this.lastPlayedAt = -Infinity
  }

  dispose() {
    this.clearSeen()
    const old = this.context
    this.context = null
    if (old && old.state !== 'closed') void old.close().catch(() => undefined)
  }

  private playTone(): boolean {
    const ctx = this.context
    if (!ctx || ctx.state !== 'running') return false
    try {
      const start = ctx.currentTime + 0.008
      // Two quiet, rounded tones (~200ms total); soft envelope prevents pops.
      for (const [frequency, offset, duration, volume] of [
        [783.99, 0, 0.15, 0.055],
        [1174.66, 0.075, 0.17, 0.043],
      ]) {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start + offset)
        gain.gain.setValueAtTime(0.0001, start + offset)
        gain.gain.exponentialRampToValueAtTime(volume, start + offset + 0.016)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + duration + 0.015)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
      return true
    } catch { return false }
  }
}
