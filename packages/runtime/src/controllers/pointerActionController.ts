import type { ActionInput, Controller, PointerActionIntent } from '@sw2d/contracts';

/**
 * Interprets the semantic actions the current input layer honestly supports
 * for pointer/touch-driven interaction: press-style actions only.
 *
 * `ActionInput` has no cursor coordinates, hover state or drag deltas, so
 * this controller does not invent them. A spatial pointer service -
 * world-space cursor position, hover targets, drag vectors - is a bounded
 * future capability; see `docs/architecture/ARCHITECTURE_OVERVIEW.md` and
 * the Phase 3 record in `PROJECT_BIBLE.md` for why it is deferred rather
 * than built here.
 */
export const pointerActionController: Controller<PointerActionIntent> = {
  read(input: ActionInput): PointerActionIntent {
    return {
      primaryPressed: input.justPressed('PRIMARY_ACTION'),
      secondaryPressed: input.justPressed('SECONDARY_ACTION'),
      interactPressed: input.justPressed('INTERACT'),
      confirmPressed: input.justPressed('CONFIRM'),
      cancelPressed: input.justPressed('CANCEL'),
    };
  },
};
