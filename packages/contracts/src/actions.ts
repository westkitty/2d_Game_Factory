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
  // Phase 8: independent aim for the top-down controller family
  // (twin-stick-shooter's defining mechanic). Four discrete directional
  // actions, the same shape MOVE_* already uses - not a spatial pointer
  // extension (ADR-0014/ARCHITECTURE_OVERVIEW's deferred spatial pointer
  // service is unrelated and stays deferred; this is a same-shape addition
  // to the existing digital-axis vocabulary, not a new architecture).
  'AIM_LEFT',
  'AIM_RIGHT',
  'AIM_UP',
  'AIM_DOWN',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export function isActionId(value: string): value is ActionId {
  return (ACTION_IDS as readonly string[]).includes(value);
}
