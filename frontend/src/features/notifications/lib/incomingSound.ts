/** Browser-local incoming message sound. Never requires a backend credential.
 * The AudioContext is created/resumed only in a trusted user gesture, respecting
 * iOS Safari/PWA and Chrome autoplay restrictions. Unlocked browser tabs may
 * play a sound in the background, while suspended tabs remain silent.
 */
export const MESSAGE_SOUND_SETTING_KEY = "chatnet-message-sound-enabled-v1";

export function readMessageSoundEnabled(): boolean {
  try {
    return localStorage.getItem(MESSAGE_SOUND_SETTING_KEY) !== "false";
  } catch {
    return true;
  }
}

export function persistMessageSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(MESSAGE_SOUND_SETTING_KEY, enabled ? "true" : "false");
  } catch {
    /* Private browsing may deny storage. Current-tab setting still works. */
  }
}

export type IncomingSoundEvent = {
  id: number;
  senderId: number;
  createdAt?: string;
};

type AudioContextFactory = () => AudioContext | null;

export type IncomingSoundResult =
  | "not-triggered" | "invalid-event" | "own-message" | "duplicate"
  | "disabled" | "rate-limited"
  | "audio-not-initialized" | "audio-unavailable" | "resuming"
  | "resume-failed" | "played";


export class IncomingMessageSound {
  private context: AudioContext | null = null;
  private readonly seen = new Set<number>();
  private readonly seenOrder: number[] = [];
  private lastPlayedAt = -Infinity;
  private generation = 0;
  private lastResult: IncomingSoundResult = "not-triggered";

  /** Safe diagnostic metadata only: never expose message content or auth data. */
  getDiagnostic(): { result: IncomingSoundResult; audioState: string } {
    return { result: this.lastResult, audioState: this.context?.state ?? "not-initialized" };
  }


  private readonly createContext: AudioContextFactory;
  private readonly now: () => number;
  private readonly visible: () => boolean;

  constructor(
    createContext: AudioContextFactory = () => {
      if (typeof window === "undefined") return null;
      const WebkitAudioContext = (
        window as typeof window & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      const AudioConstructor = window.AudioContext || WebkitAudioContext;
      return AudioConstructor ? new AudioConstructor() : null;
    },
    // Monotonic elapsed time for short rate limits/resume windows. Never
    // compare server message timestamps with the device's wall clock.
    now: () => number = () => performance.now(),
    visible: () => boolean = () => typeof document !== "undefined",
  ) {
    this.createContext = createContext;
    this.now = now;
    this.visible = visible;
  }

  /** Run synchronously from a pointer/key interaction, NOT inside SSE callbacks. */
  unlock() {
    try {
      if (!this.context || this.context.state === "closed")
        this.context = this.createContext();
      if (
        this.context &&
        this.context.state !== "running" &&
        this.context.state !== "closed"
      ) {
        void this.context.resume().catch(() => undefined);
      }
    } catch {
      /* Unsupported browser: notifications remain visual only. */
    }
  }

  /** Called only when the user clicks Test / enables the local sound setting. */
  async preview(): Promise<boolean> {
    this.unlock();
    if (!this.context) return false;
    if (this.context.state !== "running") {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    return this.playTone();
  }

  onIncoming(
    event: IncomingSoundEvent,
    myUserId: number,
    enabled: boolean,
  ): boolean {
    if (!Number.isSafeInteger(event.id) || event.id <= 0 ||
        !Number.isSafeInteger(event.senderId) || event.senderId <= 0) {
      this.lastResult = "invalid-event";
      return false;
    }
    if (event.senderId === myUserId) {
      this.lastResult = "own-message";
      return false;
    }
    if (this.seen.has(event.id)) {
      this.lastResult = "duplicate";
      return false;
    }
    this.seen.add(event.id);
    this.seenOrder.push(event.id);
    if (this.seenOrder.length > 512) this.seen.delete(this.seenOrder.shift()!);

    const now = this.now();
    // This method receives live Redis Pub/Sub messages through SSE, not
    // fetched chat history. The server's createdAt may differ from the user's
    // device clock, so it must not suppress a newly delivered notification.
    // Message IDs, session isolation and burst throttling still prevent repeats.
    if (!enabled || !this.visible()) {
      this.lastResult = "disabled";
      return false;
    }
    if (now - this.lastPlayedAt < 900) {
      this.lastResult = "rate-limited";
      return false;
    }
    const ctx = this.context;
    if (!ctx || ctx.state === "closed") {
      this.lastResult = ctx ? "audio-unavailable" : "audio-not-initialized";
      return false;
    }
    if (ctx.state !== "running") {
      // Browsers can suspend Web Audio after switching tabs or saving power.
      // Recover the existing unlocked context when a fresh message arrives;
      // never ring for an old notification after an extended suspension.
      const generation = this.generation;
      this.lastResult = "resuming";
      void ctx
        .resume()
        .then(() => {
          if (ctx !== this.context || generation !== this.generation ||
              this.now() - now > 5000 || !this.visible() ||
              this.now() - this.lastPlayedAt < 900) return;
          if (this.playTone()) {
            this.lastPlayedAt = this.now();
            this.lastResult = "played";
          } else {
            this.lastResult = "audio-unavailable";
          }
        })
        .catch(() => { if (generation === this.generation) this.lastResult = "resume-failed"; });
      return false;
    }
    if (!this.playTone()) {
      this.lastResult = "audio-unavailable";
      return false;
    }
    this.lastPlayedAt = now;
    this.lastResult = "played";
    return true;
  }

  clearSeen() {
    this.generation += 1;
    this.lastResult = "not-triggered";
    this.seen.clear();
    this.seenOrder.length = 0;
    this.lastPlayedAt = -Infinity;
  }

  dispose() {
    this.clearSeen();
    const old = this.context;
    this.context = null;
    if (old && old.state !== "closed") void old.close().catch(() => undefined);
  }

  private playTone(): boolean {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return false;
    try {
      const start = ctx.currentTime + 0.008;
      // Two clear, rounded tones (~350ms total); soft envelope prevents pops.
      for (const [frequency, offset, duration, volume] of [
        [783.99, 0, 0.23, 0.85],
        [1174.66, 0.13, 0.25, 0.98],
      ]) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(volume, start + offset + 0.016);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + offset + duration,
        );
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + duration + 0.015);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
      return true;
    } catch {
      return false;
    }
  }
}
