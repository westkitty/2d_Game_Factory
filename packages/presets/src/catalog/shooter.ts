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
 * Shmups, bullet-hell and run-and-gun already require `sw2d.weapons`.
 * Category-C Wave 11 also wires that existing pack into the vehicle
 * (asteroids heading-fire) and pointer (gallery cursor-fire) shells.
 * Rail-shooter consumes sw2d.camera for the rail path; it still does not
 * wire sw2d.weapons (look/damage owns the kill-win, not a second shooting
 * adapter).
 */
export const SHOOTER_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'horizontal-shmup',
    maturity: 'proof-validated',
    displayName: 'Horizontal Shmup',
    family: 'shooter',
    controllerFamilies: ['top-down'],
    // sw2d.encounters became required in the Arena finish program's Wave 2:
    // enemy formations are a shmup's defining mechanic, and the generated
    // top-down shell now wires content/encounters.json into a real fight
    // (bindStarterEncounters) whenever combat+weapons+encounters are present.
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.stageScroll)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'stage-scroll'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [LIMITATIONS.scrollingShmupCamera],
  }),

  definePreset({
    id: 'vertical-shmup',
    maturity: 'proof-validated',
    displayName: 'Vertical Shmup',
    family: 'shooter',
    controllerFamilies: ['top-down'],
    // Same Wave 2 change as horizontal-shmup: formations are the genre.
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.stageScroll)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'stage-scroll'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [LIMITATIONS.scrollingShmupCamera],
  }),

  definePreset({
    id: 'bullet-hell',
    maturity: 'proof-validated',
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
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [
      'Drifting rock fields and wrap-around collision stay game-specific; the generated starter steers and fires along heading through sw2d.weapons.',
      'vehicleController supplies arcade steering/throttle intent only, not rotational-inertia physics.',
    ],
  }),

  definePreset({
    id: 'gallery-shooter',
    maturity: 'proof-validated',
    displayName: 'Gallery Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    // Spatial pointer/world-space click targeting is implemented and consumed
    // by this preset's starter (capability program Phase 1, ADR-0018; proof:
    // proofs/gallery-shooter/). Category-C Wave 11 also wires sw2d.weapons
    // into the generated pointer shell (cursor-aimed fire). Authored target
    // waves stay in the frozen proof, not a reusable gallery-stage pack.
    knownLimitations: [
      'Authored gallery target waves and projectile-vs-target scoring stay in the frozen proof; the generated starter fires toward the cursor through sw2d.weapons.',
    ],
  }),

  definePreset({
    id: 'run-and-gun',
    maturity: 'proof-validated',
    displayName: 'Run and Gun',
    family: 'shooter',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.shooter,
    // Reusable weapons/projectiles consumed by the platform shell (Phase 3;
    // proof: proofs/run-and-gun/).
    knownLimitations: ['Enemy encounter orchestration (sw2d.encounters, Phase 4, ADR-0021) is reusable now, but this recipe does not install it - its enemy waves/patterns would be authored as game-specific code or by adding that pack.'],
  }),

  definePreset({
    id: 'rail-shooter',
    displayName: 'Rail Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.camera)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'camera'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    knownLimitations: [
      'Fixed-path/rail camera movement is reusable (sw2d.camera); this starter still does not wire sw2d.weapons.',
    ],
  }),
];
