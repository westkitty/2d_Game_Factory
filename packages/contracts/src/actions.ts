/**
 * Semantic action vocabulary.
 *
 * Gameplay code consumes these identifiers. It never reads KeyboardEvent.code,
 * pointer coordinates or gamepad button indices directly. Physical devices are
 * translated into actions by input adapters (see input.ts).
 */

export const ACTION_IDS = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'MOVE_UP',
  'MOVE_DOWN',
  'JUMP',
  'PRIMARY_ACTION',
  'SECONDARY_ACTION',
  'DASH',
  'INTERACT',
  'PAUSE',
  'CONFIRM',
  'CANCEL',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export function isActionId(value: string): value is ActionId {
  return (ACTION_IDS as readonly string[]).includes(value);
}
