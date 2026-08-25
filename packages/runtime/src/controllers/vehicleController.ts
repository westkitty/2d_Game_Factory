import type { ActionInput, Controller, VehicleIntent } from '@sw2d/contracts';

/**
 * Interprets semantic input into arcade vehicle-control intent: steering,
 * throttle, brake/reverse, boost. No vehicle physics, drift equations, lap
 * logic or racing rules here - those belong to a vehicle movement system
 * pack.
 */
export const vehicleController: Controller<VehicleIntent> = {
  read(input: ActionInput): VehicleIntent {
    return {
      steering: input.axis('MOVE_LEFT', 'MOVE_RIGHT'),
      throttle: input.value('MOVE_UP'),
      brake: input.value('MOVE_DOWN'),
      boostPressed: input.justPressed('DASH'),
      boostHeld: input.isDown('DASH'),
      secondaryPressed: input.justPressed('SECONDARY_ACTION'),
    };
  },
};
