import type { ActionInput, Controller, UiSimulationIntent } from '@sw2d/contracts';

/**
 * Interprets semantic input into menu-style navigation and mode-changing
 * intent.
 *
 * `confirmPressed`/`cancelPressed`/`pausePressed` claim their edge via
 * `consumePress` - the same discrete, single-owner class of read as title
 * confirm, pause and resume (ADR-0003) - so that if two layers are alive in
 * the same frame (e.g. a menu overlay that resumes gameplay), only the
 * first reader sees the press. Navigation and `primaryPressed` are plain,
 * non-claiming reads: several UI elements may reasonably want to observe
 * the same navigation press without exclusively owning it.
 *
 * Does not change scenes and does not implement menus, widgets, timers or
 * economy - it only interprets intent for whatever consumes it.
 */
export const uiSimulationController: Controller<UiSimulationIntent> = {
  read(input: ActionInput): UiSimulationIntent {
    return {
      navigateLeftPressed: input.justPressed('MOVE_LEFT'),
      navigateRightPressed: input.justPressed('MOVE_RIGHT'),
      navigateUpPressed: input.justPressed('MOVE_UP'),
      navigateDownPressed: input.justPressed('MOVE_DOWN'),
      confirmPressed: input.consumePress('CONFIRM'),
      cancelPressed: input.consumePress('CANCEL'),
      pausePressed: input.consumePress('PAUSE'),
      primaryPressed: input.justPressed('PRIMARY_ACTION'),
    };
  },
};
