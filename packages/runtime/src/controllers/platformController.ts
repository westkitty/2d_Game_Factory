import type { ActionInput, Controller, PlatformIntent } from '@sw2d/contracts';

/**
 * Interprets semantic input into side-view movement intent.
 *
 * Stateless: every field is recomputed from the current `ActionInput` on
 * each `read()` call, except `jumpPressed`, which claims its edge via
 * `consumePress` - jump-trigger is a discrete, single-owner decision, the
 * same class of read as pause/resume/confirm (see ADR-0003). Everything
 * else here is a plain, non-claiming read so other systems may observe it
 * freely in the same frame.
 */
export const platformController: Controller<PlatformIntent> = {
  read(input: ActionInput): PlatformIntent {
    return {
      moveAxis: input.axis('MOVE_LEFT', 'MOVE_RIGHT'),
      jumpPressed: input.consumePress('JUMP'),
      jumpHeld: input.isDown('JUMP'),
      dashPressed: input.justPressed('DASH'),
      dashHeld: input.isDown('DASH'),
      primaryPressed: input.justPressed('PRIMARY_ACTION'),
      secondaryPressed: input.justPressed('SECONDARY_ACTION'),
      interactPressed: input.justPressed('INTERACT'),
    };
  },
};
