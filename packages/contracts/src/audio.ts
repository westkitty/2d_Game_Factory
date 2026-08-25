import type { Disposable } from './disposable.ts';
import type { GameSettings } from './persistence.ts';

/**
 * Semantic audio cues. The runtime owns the vocabulary; a theme owns the sound.
 * Phase 1 synthesises these locally so the foundation needs no audio files and
 * no remote asset host.
 */
export const AUDIO_CUES = [
  'ui.move',
  'ui.confirm',
  'ui.cancel',
  'game.start',
  'game.pause',
  'game.resume',
  'game.restart',
] as const;

export type AudioCueId = (typeof AUDIO_CUES)[number];

export type AudioUnlockState = 'locked' | 'unlocked' | 'unavailable';

/**
 * Browsers do not reliably permit audio before a user gesture. The bus starts
 * 'locked', unlocks on the first qualifying gesture, and degrades to
 * 'unavailable' rather than throwing when Web Audio is absent.
 */
export interface AudioBus extends Disposable {
  readonly unlockState: AudioUnlockState;
  playCue(cue: AudioCueId): void;
  applySettings(settings: GameSettings): void;
}
