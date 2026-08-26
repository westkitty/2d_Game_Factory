/**
 * @sw2d/presets - the genre preset catalogue.
 *
 * Phase 7A: families A-C (platforming, top-down action, shooter), 27
 * recipes. Phase 7B: families D-F (vehicle/movement, puzzle/arcade,
 * strategy/defense), 22 more - 49 total. Every recipe is a composition of
 * real controller families and real @sw2d/packs system packs - never a fork
 * of the runtime. Production code here depends on @sw2d/contracts and
 * @sw2d/packs' side-effect-free `ids` subpath only: no Ajv, no Phaser
 * (ADR-0015).
 */
export { PRESETS, UnknownPresetError, getPreset, getPresetsByFamily, listPresets } from './catalog.ts';

export { PLATFORMING_PRESETS } from './catalog/platforming.ts';
export { TOP_DOWN_ACTION_PRESETS } from './catalog/topDownAction.ts';
export { SHOOTER_PRESETS } from './catalog/shooter.ts';
export { VEHICLE_MOVEMENT_PRESETS } from './catalog/vehicleMovement.ts';
export { PUZZLE_ARCADE_PRESETS } from './catalog/puzzleArcade.ts';
export { STRATEGY_DEFENSE_PRESETS } from './catalog/strategyDefense.ts';

export { materializeStarterPlan, type StarterPlan } from './materialize.ts';

export {
  ALL_VALIDATION_PROFILES,
  BASE_INPUT_MODES,
  LIMITATIONS,
  POINTER_INPUT_MODES,
  VALIDATION_PROFILES,
  type ValidationProfileId,
} from './shared.ts';
