/**
 * Semantic UI states and overridable copy.
 *
 * The runtime knows *that* the game is paused; it does not know what the game
 * calls pausing. Copy arrives from the content bundle so no game identity, lore
 * or joke ever lands in reusable runtime code.
 */
export const UI_STATES = [
  'TITLE',
  'PLAYING',
  'PAUSED',
  'GAME_OVER',
  'LEVEL_COMPLETE',
  'SETTINGS',
  'ACCESSIBILITY',
] as const;

export type UiStateId = (typeof UI_STATES)[number];

/** Neutral strings the runtime falls back to when content supplies none. */
export interface UiCopy {
  readonly title: string;
  readonly subtitle: string;
  readonly startPrompt: string;
  readonly playHint: string;
  readonly pausedHeading: string;
  readonly pausedResume: string;
  readonly pausedRestart: string;
  readonly pausedQuit: string;
}

export const DEFAULT_UI_COPY: UiCopy = {
  title: 'SW2D RUNTIME',
  subtitle: 'foundation slice',
  startPrompt: 'PRESS ENTER OR SPACE TO START',
  playHint: 'MOVE / JUMP  -  PAUSE TO STOP',
  pausedHeading: 'PAUSED',
  pausedResume: 'CONFIRM  RESUME',
  pausedRestart: 'SECONDARY  RESTART',
  pausedQuit: 'CANCEL  TITLE',
};
