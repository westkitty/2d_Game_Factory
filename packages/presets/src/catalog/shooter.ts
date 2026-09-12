import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

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
    // Final Product Completion Wave 3 (matrix L11): parallax layers and the
    // rail path (speed / cross-drift legs) are authored in content/stage-scroll.json
    // and drawn by the shared shell; enemy formations sweep the stage through
    // sw2d.encounters `formation` spawn points; bullets are pooled (L12).
    knownLimitations: [],
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
    // Final Product Completion Wave 3 (matrix L11): parallax layers and the
    // rail path (speed / cross-drift legs) are authored in content/stage-scroll.json
    // and drawn by the shared shell; enemy formations sweep the stage through
    // sw2d.encounters `formation` spawn points; bullets are pooled (L12).
    knownLimitations: [],
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
    // Final Product Completion Wave 3 (matrix L12): the projectile runtime is
    // pooled (sprites and colliders allocated to the peak, then reused) and
    // benchmarked by `npm run qa:bullet-budget` on the target desktop browser
    // - see docs/qa/QA_MATRIX.md for the supported simultaneous-bullet budget.
    knownLimitations: [],
  }),

  definePreset({
    id: 'asteroids-shooter',
    maturity: 'proof-validated',
    displayName: 'Asteroids Shooter',
    family: 'shooter',
    controllerFamilies: ['vehicle'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.vehicles), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'vehicles'],
    validationProfile: VALIDATION_PROFILES.shooter,
    // Final Product Completion Wave 3 (matrix L13 / L14): the ship is the
    // reusable sw2d.vehicles `ship` profile (Newtonian thrust with momentum,
    // rotational inertia, wrap-around) and the generated vehicle shell runs
    // the actual Asteroids loop - a drifting, wrapping rock field, projectile
    // vs rock collision through sw2d.weapons / sw2d.combat, rock splitting,
    // sw2d.arcade score, ship collision and lives, successive waves,
    // fail / restart (bindStarterAsteroids).
    vehicleProfile: 'ship',
    knownLimitations: [],
  }),

  definePreset({
    id: 'gallery-shooter',
    maturity: 'proof-validated',
    displayName: 'Gallery Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'encounters'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    // Spatial pointer/world-space click targeting is implemented and consumed
    // by this preset's starter (capability program Phase 1, ADR-0018).
    // Final Product Completion Wave 3 (matrix L15): the generated pointer
    // shell runs authored target rounds (sw2d.encounters `drift` targets in
    // formations, a sequence of rounds, a time limit) scored through
    // sw2d.arcade, with hit / miss accuracy - bindStarterGallery.
    knownLimitations: [],
  }),

  definePreset({
    id: 'run-and-gun',
    maturity: 'proof-validated',
    displayName: 'Run and Gun',
    family: 'shooter',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'encounters'],
    validationProfile: VALIDATION_PROFILES.shooter,
    // Reusable weapons/projectiles consumed by the platform shell (Phase 3;
    // proof: proofs/run-and-gun/). Final Product Completion Wave 3 (matrix
    // L16): sw2d.encounters is required and the platform shell binds it -
    // `ground` walkers come in under gravity, a shooter holds and fires.
    knownLimitations: [],
  }),

  definePreset({
    id: 'rail-shooter',
    maturity: 'proof-validated',
    displayName: 'Rail Shooter',
    family: 'shooter',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.camera), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'camera', 'encounters'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.shooter,
    // Final Product Completion Wave 3 (matrix L17): the gun rides the reusable
    // sw2d.camera rail and fires the sw2d.weapons catalog weapon at
    // sw2d.encounters `approach` drones, scored through sw2d.arcade
    // (bindStarterGallery in rail mode).
    knownLimitations: [],
  }),
];
