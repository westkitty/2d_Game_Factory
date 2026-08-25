import type { AudioBus, AudioCueId, AudioUnlockState, GameSettings } from '@sw2d/contracts';

interface CueSpec {
  readonly frequency: number;
  readonly durationMs: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

/**
 * Cues are synthesised, not loaded.
 *
 * That keeps the Phase 1 foundation entirely free of audio files - nothing to
 * fetch, nothing to license, nothing that could reach a remote host. A theme
 * pack replaces this with real samples in a later phase without gameplay code
 * changing: it still just asks for a semantic cue.
 */
const CUES: Record<AudioCueId, CueSpec> = {
  'ui.move': { frequency: 420, durationMs: 45, type: 'square', gain: 0.25 },
  'ui.confirm': { frequency: 660, durationMs: 90, type: 'square', gain: 0.35 },
  'ui.cancel': { frequency: 220, durationMs: 90, type: 'square', gain: 0.3 },
  'game.start': { frequency: 880, durationMs: 140, type: 'triangle', gain: 0.35 },
  'game.pause': { frequency: 330, durationMs: 110, type: 'triangle', gain: 0.3 },
  'game.resume': { frequency: 550, durationMs: 110, type: 'triangle', gain: 0.3 },
  'game.restart': { frequency: 440, durationMs: 160, type: 'sawtooth', gain: 0.28 },
};

type AudioContextCtor = new () => AudioContext;

/**
 * Master/music/SFX gain structure with gesture-safe unlock.
 *
 * Autoplay is never assumed. The bus stays 'locked' until a real user gesture
 * arrives, and reports 'unavailable' - rather than throwing - where Web Audio
 * does not exist. Music routing is wired but silent in Phase 1; a theme supplies
 * the source later.
 */
export class WebAudioBus implements AudioBus {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #music: GainNode | null = null;
  #sfx: GainNode | null = null;
  #state: AudioUnlockState = 'locked';
  #settings: GameSettings | null = null;
  #disposed = false;

  get unlockState(): AudioUnlockState {
    return this.#state;
  }

  /** Music gain node, reserved for the theme-supplied music source. */
  get musicNode(): GainNode | null {
    return this.#music;
  }

  /**
   * Call from a user-gesture handler. Safe to call repeatedly; only the first
   * call constructs an AudioContext.
   */
  unlock(): void {
    if (this.#disposed || this.#state !== 'locked') return;
    const Ctor = (globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
      .AudioContext
      ?? (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) {
      this.#state = 'unavailable';
      return;
    }
    try {
      const context = new Ctor();
      const master = context.createGain();
      const music = context.createGain();
      const sfx = context.createGain();
      music.connect(master);
      sfx.connect(master);
      master.connect(context.destination);
      this.#context = context;
      this.#master = master;
      this.#music = music;
      this.#sfx = sfx;
      this.#state = 'unlocked';
      if (this.#settings) this.applySettings(this.#settings);
      void context.resume().catch(() => undefined);
    } catch (error) {
      console.warn('[sw2d] audio unavailable', error);
      this.#state = 'unavailable';
    }
  }

  applySettings(settings: GameSettings): void {
    this.#settings = settings;
    if (!this.#master || !this.#music || !this.#sfx) return;
    const master = settings.muted ? 0 : settings.masterVolume;
    this.#master.gain.value = master;
    this.#music.gain.value = settings.musicVolume;
    this.#sfx.gain.value = settings.sfxVolume;
  }

  playCue(cue: AudioCueId): void {
    if (this.#disposed || this.#state !== 'unlocked') return;
    const context = this.#context;
    const destination = this.#sfx;
    if (!context || !destination) return;
    const spec = CUES[cue];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.frequency, now);
    // Short attack/decay envelope; a raw gate would click.
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(spec.gain, now + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + spec.durationMs / 1000);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + spec.durationMs / 1000 + 0.02);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      this.#music?.disconnect();
      this.#sfx?.disconnect();
      this.#master?.disconnect();
      void this.#context?.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    this.#context = null;
    this.#master = null;
    this.#music = null;
    this.#sfx = null;
  }
}
