import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family D - Vehicle / movement (recipes 28-32).
 *
 * All five use the `vehicle` controller family - INPUT INTENT ONLY
 * (`vehicleController`, ADR-0009). As of the capability program's Phase 10
 * (ADR-0027) the reusable `sw2d.vehicles` (`vehicle.motion`) capability turns
 * that intent into motion through four bounded profiles (car / kart / boat /
 * flight), and `sw2d.racing` (`race.state`) owns ordered checkpoints, laps,
 * the countdown and time-trial timing - separate systems, per the phase's own
 * rule. `LIMITATIONS` retained only where a recipe still has a real gap on top
 * of what those services deliver.
 */
export const VEHICLE_MOVEMENT_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'top-down-racer',
    maturity: 'smoke-validated',
    displayName: 'Top-Down Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.vehicles), pack(PACK_IDS.racing)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles', 'races'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'car',
    knownLimitations: [],
  }),

  definePreset({
    id: 'kart-racer',
    displayName: 'Kart Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.vehicles), pack(PACK_IDS.racing)],
    optionalSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.items)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles', 'races'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'kart',
    knownLimitations: [
      'Holding and firing a kart item on demand (a shell, an on-use boost pickup) is game-specific code; item boxes grant canonical sw2d.items entries (Phase 2), and drift / handling are the reusable sw2d.vehicles kart profile.',
    ],
  }),

  definePreset({
    id: 'time-trial-racer',
    displayName: 'Time Trial Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade), pack(PACK_IDS.vehicles), pack(PACK_IDS.racing)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles', 'races'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'car',
    knownLimitations: [],
  }),

  definePreset({
    id: 'endless-driving',
    displayName: 'Endless Driving',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.generation), pack(PACK_IDS.vehicles)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'generation', 'vehicles'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'car',
    // Phase 7 (ADR-0024) road generation + Phase 10 (ADR-0027) vehicle handling.
    knownLimitations: [],
  }),

  definePreset({
    id: 'boat-flight-racer',
    displayName: 'Boat / Flight Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.vehicles)],
    optionalSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.racing)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'boat',
    knownLimitations: [
      'The boat and flight profiles are bounded arcade handling (momentum, drag, lateral grip, and for flight a 2D altitude band) - not fluid or aerodynamic simulation.',
    ],
  }),
];
