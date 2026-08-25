import type { ActionInput, Controller, TopDownIntent } from '@sw2d/contracts';

/**
 * Interprets semantic input into 4/8-way or analog top-down movement
 * intent. Bounds the movement vector to length <= 1 so pressing two
 * cardinal directions at once is not faster than pressing one - a
 * documented part of this controller's contract (see `TopDownIntent`), not
 * an incidental clamp. No velocity, collision, navigation or combat here.
 */
export const topDownController: Controller<TopDownIntent> = {
  read(input: ActionInput): TopDownIntent {
    const rawX = input.axis('MOVE_LEFT', 'MOVE_RIGHT');
    const rawY = input.axis('MOVE_UP', 'MOVE_DOWN');
    const rawMagnitude = Math.hypot(rawX, rawY);
    const scale = rawMagnitude > 1 ? 1 / rawMagnitude : 1;

    return {
      moveX: rawX * scale,
      moveY: rawY * scale,
      moveMagnitude: Math.min(rawMagnitude, 1),
      primaryPressed: input.justPressed('PRIMARY_ACTION'),
      secondaryPressed: input.justPressed('SECONDARY_ACTION'),
      dashPressed: input.justPressed('DASH'),
      dashHeld: input.isDown('DASH'),
      interactPressed: input.justPressed('INTERACT'),
    };
  },
};
