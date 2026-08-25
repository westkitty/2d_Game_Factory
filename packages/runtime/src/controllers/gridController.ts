import type { ActionId, ActionInput, Controller, GridDirection, GridIntent } from '@sw2d/contracts';

/** Priority when more than one movement action transitions to pressed in the same frame. */
const DIRECTION_PRIORITY: readonly { readonly direction: GridDirection; readonly action: ActionId }[] = [
  { direction: 'up', action: 'MOVE_UP' },
  { direction: 'down', action: 'MOVE_DOWN' },
  { direction: 'left', action: 'MOVE_LEFT' },
  { direction: 'right', action: 'MOVE_RIGHT' },
];

/**
 * Interprets semantic input into one discrete directional step per physical
 * press - suitable for grid navigation, Sokoban-like movement or
 * turn-based selection.
 *
 * Uses the existing `justPressed` edge directly rather than a parallel edge
 * tracker: `ActionInputHost` already guarantees `justPressed` is true for
 * exactly one frame per press, which is exactly "one step per press." No
 * key-repeat scheduling, turn system, board state, undo or push/pull rule
 * lives here - only the intent.
 */
export const gridController: Controller<GridIntent> = {
  read(input: ActionInput): GridIntent {
    let step: GridDirection | null = null;
    for (const entry of DIRECTION_PRIORITY) {
      if (input.justPressed(entry.action)) {
        step = entry.direction;
        break;
      }
    }
    return {
      step,
      confirmPressed: input.justPressed('CONFIRM'),
      cancelPressed: input.justPressed('CANCEL'),
    };
  },
};
