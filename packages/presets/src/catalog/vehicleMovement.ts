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
    maturity: 'proof-validated',
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
    maturity: 'proof-validated',
    displayName: 'Kart Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.vehicles), pack(PACK_IDS.racing), pack(PACK_IDS.items)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles', 'races', 'items'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'kart',
    // Final Product Completion Wave 4 (matrix L18): item boxes grant a
    // canonical sw2d.items held slot; J consumes it (shell / boost).
    knownLimitations: [],
  }),

  definePreset({
    id: 'time-trial-racer',
    maturity: 'proof-validated',
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
    maturity: 'proof-validated',
    displayName: 'Endless Driving',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.generation), pack(PACK_IDS.vehicles), pack(PACK_IDS.items)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'generation', 'vehicles', 'items'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'car',
    // Final Product Completion Wave 4 (matrix L19): same held-item loop as
    // kart-racer (boost), plus traffic crash / best-distance persistence.
    knownLimitations: [],
  }),

  definePreset({
    id: 'boat-flight-racer',
    maturity: 'proof-validated',
    displayName: 'Boat / Flight Racer',
    family: 'vehicle-movement',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.vehicles), pack(PACK_IDS.racing)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'vehicles', 'races'],
    validationProfile: VALIDATION_PROFILES.vehicleMovement,
    vehicleProfile: 'boat',
    // Final Product Completion Wave 4 (matrix L20): arcade boat/flight loop
    // with checkpoints, a buoy hazard, altitude band and restart. Not CFD.
    knownLimitations: [],
  }),
];
