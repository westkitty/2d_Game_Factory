import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family C - Shooter (recipes 21-27).
 *
 * Controller routing follows MASTER_PROJECT.md section 6 exactly: shmup/
 * bullet-hell/run-and-gun motion models map to `top-down` (or `platform` for
 * run-and-gun's side-view movement), asteroids-like to `vehicle`, and
 * gallery/rail shooters - which are about a fixed viewpoint plus targeting,
 * not locomotion - to `pointer`.
 *
 * None of the seven references a projectile/weapon pack: `sw2d.combat` is a
 * health/damage model only today ("deliberately not a combat system - no
 * weapons, projectiles, melee collision, knockback" - combatPack.ts's own
 * doc comment). Every recipe here states that gap in knownLimitations
 * instead of implying weapons exist.
 */
export const SHOOTER_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'horizontal-shmup',
    displayName: 'Horizontal Shmup',
    family: 'shooter',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: ['The reusable encounter capability (sw2d.encounters, ADR-0021) exists; this starter does not wire enemy formations into its shell yet.'],
  }),

  definePreset({
    id: 'vertical-shmup',
    displayName: 'Vertical Shmup',
    family: 'shooter',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: ['The reusable encounter capability (sw2d.encounters, ADR-0021) exists; this starter does not wire enemy formations into its shell yet.'],
  }),

  definePreset({
    id: 'bullet-hell',
    maturity: 'smoke-validated',
    displayName: 'Bullet Hell',
    family: 'shooter',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.shooter,
    // Dense bullet-pattern choreography, waves and phases are reusable now
    // (capability program Phase 4, ADR-0021; proof: proofs/bullet-hell/).
    knownLimitations: [
      'Per-bullet GPU-scale pooling for thousands of simultaneous bullets is not tuned; patterns are bounded.',
    ],
  }),

  definePreset({
    id: 'asteroids-shooter',
    displayName: 'Asteroids Shooter',
    family: 'shooter',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [
      LIMITATIONS.weaponsProjectiles,
      'vehicleController supplies arcade steering/throttle intent only, not rotational-inertia physics.',
    ],
  }),

  definePreset({
    id: 'gallery-shooter',
    displayName: 'Gallery Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    // Spatial pointer/world-space click targeting is implemented and consumed
    // by this preset's starter (capability program Phase 1, ADR-0018; proof:
    // proofs/gallery-shooter/). Weapons/projectiles remain a later phase.
    knownLimitations: [LIMITATIONS.weaponsProjectiles],
  }),

  definePreset({
    id: 'run-and-gun',
    displayName: 'Run and Gun',
    family: 'shooter',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.shooter,
    // Reusable weapons/projectiles consumed by the platform shell (Phase 3;
    // proof: proofs/run-and-gun/). Encounter orchestration is Phase 4.
    knownLimitations: ['Enemy encounter orchestration is not yet a reusable capability (Phase 4).'],
  }),

  definePreset({
    id: 'rail-shooter',
    displayName: 'Rail Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [
      LIMITATIONS.weaponsProjectiles,
      // Spatial pointer/world-space targeting is implemented and consumed by the
      // pointer shell (capability program Phase 1, ADR-0018).
      'Fixed-path/rail camera movement is not yet a reusable capability.',
    ],
  }),
];
