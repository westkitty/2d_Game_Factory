import { type ActionBindings } from '@sw2d/contracts';

/**
 * Factory-default physical bindings.
 *
 * Keyboard entries are KeyboardEvent.code values, so they follow physical key
 * position rather than the user's layout. Pointer targets match a DOM element's
 * `data-sw2d-action` attribute, which is how the on-screen/touch controls bind
 * without gameplay code learning anything about touch.
 *
 * A game or preset overrides any subset of these; it never has to restate them all.
 */
export const DEFAULT_BINDINGS: ActionBindings = {
  MOVE_LEFT: { keyboard: ['ArrowLeft', 'KeyA'], pointerTargets: ['MOVE_LEFT'] },
  MOVE_RIGHT: { keyboard: ['ArrowRight', 'KeyD'], pointerTargets: ['MOVE_RIGHT'] },
  MOVE_UP: { keyboard: ['ArrowUp', 'KeyW'], pointerTargets: ['MOVE_UP'] },
  MOVE_DOWN: { keyboard: ['ArrowDown', 'KeyS'], pointerTargets: ['MOVE_DOWN'] },
  JUMP: { keyboard: ['Space', 'KeyZ'], pointerTargets: ['JUMP'] },
  PRIMARY_ACTION: { keyboard: ['KeyJ', 'KeyX'], pointerTargets: ['PRIMARY_ACTION'] },
  SECONDARY_ACTION: { keyboard: ['KeyK', 'KeyC'], pointerTargets: ['SECONDARY_ACTION'] },
  DASH: { keyboard: ['ShiftLeft', 'ShiftRight'], pointerTargets: ['DASH'] },
  INTERACT: { keyboard: ['KeyE'], pointerTargets: ['INTERACT'] },
  PAUSE: { keyboard: ['KeyP', 'Escape'], pointerTargets: ['PAUSE'] },
  CONFIRM: { keyboard: ['Enter', 'Space', 'NumpadEnter'], pointerTargets: ['CONFIRM'] },
  // Escape belongs to PAUSE only: binding it to CANCEL as well would make one
  // keypress both resume and quit, which is precisely the double-consumption
  // failure documented in the c_chase extraction.
  CANCEL: { keyboard: ['Backspace'], pointerTargets: ['CANCEL'] },
};

/** Merge overrides over the defaults, replacing (not concatenating) per action. */
export function mergeBindings(overrides: ActionBindings | undefined): ActionBindings {
  if (!overrides) return DEFAULT_BINDINGS;
  return { ...DEFAULT_BINDINGS, ...overrides };
}
