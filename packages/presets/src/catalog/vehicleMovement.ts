import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family D - Vehicle / movement (recipes 28-32).
 *
 * All five use the `vehicle` controller family - arcade steering/throttle/
 * brake intent only (MASTER_PROJECT.md section 7). None references a racing
 * pack: no `@sw2d/packs` capability owns lap counting, checkpoints-in-order,
 * or vehicle handling - `vehicleController` supplies intent, the rest is
 * game-specific code, the same split every other family's controllers keep.
 * Every recipe states that gap (`LIMITATIONS.vehicleIntentOnly` +
 * `LIMITATIONS.raceOrchestration`) rather than implying a racing system
 * exists.
 */
export const VEHICLE_MOVEMENT_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'top-down-racer',
    maturity: 'smoke-validated',
    displayName: 'Top-Down Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    knownLimitations: [LIMITATIONS.vehicleIntentOnly, LIMITATIONS.raceOrchestration],
  }),

  definePreset({
    id: 'kart-racer',
    displayName: 'Kart Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    knownLimitations: [
      LIMITATIONS.vehicleIntentOnly,
      LIMITATIONS.raceOrchestration,
      'Item/pickup effects beyond the Collectible Tiled object class (Phase 6) have no dedicated schema or effect system yet.',
    ],
  }),

  definePreset({
    id: 'time-trial-racer',
    displayName: 'Time Trial Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    knownLimitations: [LIMITATIONS.vehicleIntentOnly, LIMITATIONS.raceOrchestration],
  }),

  definePreset({
    id: 'endless-driving',
    displayName: 'Endless Driving',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    knownLimitations: [LIMITATIONS.vehicleIntentOnly, LIMITATIONS.proceduralGeneration],
  }),

  definePreset({
    id: 'boat-flight-racer',
    displayName: 'Boat / Flight Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    knownLimitations: [
      LIMITATIONS.vehicleIntentOnly,
      LIMITATIONS.raceOrchestration,
      'No reusable buoyancy/altitude/flight model exists yet.',
    ],
  }),
];
