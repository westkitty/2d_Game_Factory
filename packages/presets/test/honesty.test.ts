import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/index.ts';

/**
 * Honesty checks MASTER_PROJECT.md sections 5, 12/9/11 and 13 require
 * directly: maturity never overstated, gamepad never claimed, and the
 * specific recipes the master plan names (Phase 7A section 12, Phase 7B
 * section 9, Phase 7C section 11) must carry their required
 * knownLimitations text.
 */

/**
 * Every preset here has a committed, frozen proof game under `proofs/<id>/`
 * (PROOF_CONTRACT.md + real generated composition) and a dedicated
 * real-browser proof spec in `packages/qa/proof-specs/*.ts`, wired into
 * `npm run qa:proof` (23/23 as of this revision). Phase 10 established the
 * first five; the capability-completion program (Phases 1-10, ADR-0018..0027)
 * added the other eighteen. The Arena finish program reconciled the catalog
 * with this evidence one preset at a time - see
 * docs/architecture/ARENA_FACTORY_FINISH_STATE.md. Only these twenty-three
 * may claim 'proof-validated'.
 */
const PROOF_VALIDATED_IDS = [
  'chase-platformer',
  'twin-stick-shooter',
  'tower-defense',
  'sokoban',
  'idle-incremental',
  // Capability program proof consumers, promoted after per-preset evidence
  // reconciliation (each name below is literally a proofs/<id>/ directory).
  'gallery-shooter',
  'point-and-click',
  'collectathon-platformer',
  'top-down-adventure',
  'run-and-gun',
  'bullet-hell',
  'boss-rush',
  'turn-based-tactics',
  'lane-defense',
  'puzzle-platformer',
  'endless-runner',
  'dungeon-crawler',
  'metroidvania',
  'exploration-game',
  'grappling-platformer',
  'physics-toy',
  'top-down-racer',
  'time-trial-racer',
].sort();

/**
 * Phase 8's remaining representative demos (demos/<preset-id>/), each with a
 * real, committed browser smoke test (packages/qa/specs/*.ts) that passed
 * against system Chrome - see docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md.
 * Everything that has since earned a committed proof game graduated to
 * 'proof-validated' (above); these three still have demo-level evidence only.
 * Every other preset stays 'recipe' until it earns the same real evidence.
 */
const SMOKE_VALIDATED_IDS = [
  'traditional-platformer',
  'stealth-game',
  'visual-novel',
].sort();

describe('maturity honesty', () => {
  it('exactly the twenty-three presets with committed passing proof games are "proof-validated", nothing else', () => {
    const actual = PRESETS.filter((p) => p.maturity === 'proof-validated')
      .map((p) => p.id)
      .sort();
    expect(actual).toEqual(PROOF_VALIDATED_IDS);
  });

  it('exactly the remaining three Phase 8 demo presets are "smoke-validated", nothing else', () => {
    const actual = PRESETS.filter((p) => p.maturity === 'smoke-validated')
      .map((p) => p.id)
      .sort();
    expect(actual).toEqual(SMOKE_VALIDATED_IDS);
  });

  it('every other preset stays "recipe" - no experimental claims yet', () => {
    for (const preset of PRESETS) {
      if (PROOF_VALIDATED_IDS.includes(preset.id)) {
        expect(preset.maturity, preset.id).toBe('proof-validated');
      } else if (SMOKE_VALIDATED_IDS.includes(preset.id)) {
        expect(preset.maturity, preset.id).toBe('smoke-validated');
      } else {
        expect(preset.maturity, preset.id).toBe('recipe');
      }
    }
  });

  it('no preset claims "experimental" - not a maturity tier any phase has reached yet', () => {
    for (const preset of PRESETS) {
      expect(preset.maturity, preset.id).not.toBe('experimental');
    }
  });

  it('exactly 23 proof-validated, 3 smoke-validated and 48 recipe presets out of the full 74-preset catalog', () => {
    expect(PRESETS.length).toBe(74);
    expect(PRESETS.filter((p) => p.maturity === 'proof-validated').length).toBe(23);
    expect(PRESETS.filter((p) => p.maturity === 'smoke-validated').length).toBe(3);
    expect(PRESETS.filter((p) => p.maturity === 'recipe').length).toBe(48);
  });
});

describe('input-mode honesty', () => {
  it('no preset claims gamepad support - adapter feasibility is still unknown (OPERATIONAL_STATE.md)', () => {
    for (const preset of PRESETS) {
      expect(preset.supportedInputModes, preset.id).not.toContain('gamepad');
    }
  });

  it('every preset supports at least keyboard - the one input path every recipe can rely on', () => {
    for (const preset of PRESETS) {
      expect(preset.supportedInputModes, preset.id).toContain('keyboard');
    }
  });

  it('pointer-controller-family presets advertise the pointer input mode', () => {
    for (const preset of PRESETS) {
      if (preset.controllerFamilies.includes('pointer')) {
        expect(preset.supportedInputModes, preset.id).toContain('pointer');
      }
    }
  });
});

describe('required knownLimitations (MASTER_PROJECT.md section 12)', () => {
  const cases: ReadonlyArray<{ id: string; pattern: RegExp }> = [
    { id: 'stealth-game', pattern: /Vision cones, occlusion, suspicion, noise and hiding are reusable/ },
    { id: 'heist-game', pattern: /Vision cones, occlusion, suspicion, noise and hiding are reusable/ },
    { id: 'horizontal-shmup', pattern: /scrolling-stage camera movement/ },
    { id: 'vertical-shmup', pattern: /scrolling-stage camera movement/ },
    { id: 'bullet-hell', pattern: /Per-bullet GPU-scale pooling/ },
    { id: 'run-and-gun', pattern: /Enemy encounter orchestration/ },
    { id: 'boss-rush', pattern: /Sequencing multiple bosses/ },
    // Phase 7B (MASTER_PROJECT.md section 9)
    { id: 'match-puzzle', pattern: /Match-detection\/cascade and falling-piece\/line-clear are reusable/ },
    { id: 'falling-block-puzzle', pattern: /Match-detection\/cascade and falling-piece\/line-clear are reusable/ },
    { id: 'action-adventure', pattern: /Melee strike, knockback, hit-stun and contact damage are reusable/ },
    { id: 'arena-combat', pattern: /Melee strike, knockback, hit-stun and contact damage are reusable/ },
    { id: 'breakout', pattern: /Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable/ },
    { id: 'pong', pattern: /Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable/ },
    { id: 'rhythm-action', pattern: /music-beat\/audio-synchronization/ },
    { id: 'reaction-timing', pattern: /sw2d\.timing/ },
    { id: 'tower-defense', pattern: /keyboard grid cursor/ },
    { id: 'tower-defense', pattern: /route-following pathfinding is reusable/ },
    { id: 'lane-defense', pattern: /Lane-spawn scheduling and combat resolution are still starter-specific/ },
    { id: 'auto-battler', pattern: /autonomous combat orchestration is not implemented/ },
    { id: 'simple-rts', pattern: /box-select and command-queue UI are not implemented/ },
    { id: 'turn-based-tactics', pattern: /turn-action state machine are still starter-specific/ },
    { id: 'base-defense', pattern: /base-damage\/target-priority/ },
    { id: 'territory-control', pattern: /Reusable capture-zone\/territory ownership\/scoring mechanics/ },
    // Phase 7C (MASTER_PROJECT.md section 11)
    { id: 'idle-incremental', pattern: /offline-progress\/catch-up, prestige, and large economy balancing/ },
    { id: 'shopkeeper', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'tycoon-lite', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'restaurant', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'farming-lite', pattern: /No reusable crop-growth\/season\/plot-interaction system/ },
    { id: 'pet-creature', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'virtual-pet', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'aquarium-terrarium', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'colony-lite', pattern: /needs, assignment AI, construction placement and colony simulation are not/ },
    { id: 'visual-novel', pattern: /Branching dialogue graphs, choices, flags and endings are reusable/ },
    { id: 'point-and-click', pattern: /Branching dialogue graphs, choices, flags and endings are reusable/ },
    { id: 'interactive-fiction-hybrid', pattern: /No dedicated parser\/text-command system/ },
    { id: 'investigation-game', pattern: /No evidence-board\/deduction\/linking system/ },
    { id: 'museum-exhibit', pattern: /No dedicated exhibit\/codex presentation framework/ },
    { id: 'escape-room', pattern: /No content-authored escape-room puzzle grammar/ },
    { id: 'microgame-collection', pattern: /No microgame scheduler\/rotation\/meta-framework/ },
    { id: 'local-party-game', pattern: /Local hot-seat turns and simultaneous versus axes are reusable/ },
    { id: 'dress-up-character-toy', pattern: /No wardrobe\/attachment system is built on the drag/ },
    { id: 'sandbox-playground', pattern: /No generalized authoring\/editing sandbox/ },
    { id: 'drawing-game', pattern: /No canvas-stroke\/drawing capture is built on the spatial pointer/ },
    { id: 'fishing-game', pattern: /No reusable casting\/line\/tension\/fish behavior system/ },
    { id: 'cooking-game', pattern: /No reusable ingredient\/recipe\/action-sequence cooking system/ },
    { id: 'photography-game', pattern: /No reusable camera\/framing\/scoring\/photo-capture gameplay system/ },
    { id: 'asteroids-shooter', pattern: /sw2d\.weapons/ },
    { id: 'gallery-shooter', pattern: /sw2d\.weapons/ },
    { id: 'rail-shooter', pattern: /this starter's shell does not wire it yet/ },
  ];

  cases.forEach(({ id, pattern }, index) => {
    it(`${id} states its required limitation (${index})`, () => {
      const preset = PRESETS.find((p) => p.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.knownLimitations.some((limitation) => pattern.test(limitation)), preset!.knownLimitations.join(' | ')).toBe(
        true,
      );
    });
  });

  it('no preset has an empty knownLimitations array while depending on a foundational (non-genre-complete) pack', () => {
    // combat, ai, puzzle, strategy and (Phase 7C) simulation, narrative are all explicitly
    // "foundational core, not a full genre system" (see each pack's own doc comment -
    // simulationPack.ts literally names this family's own recipes as what it is not: "a
    // deterministic resource ledger plus a timed-job primitive ... No farms, shops, restaurants,
    // colonies, needs AI or tycoon UI here"; narrativePack.ts: "lightweight state for later visual
    // novel/adventure systems ... No scripting language, renderer, portrait system, dialogue graph
    // loader ... quest framework here") - any preset requiring one honestly has at least one
    // limitation.
    const foundational = new Set(['sw2d.combat', 'sw2d.ai', 'sw2d.puzzle', 'sw2d.strategy', 'sw2d.simulation', 'sw2d.narrative']);
    for (const preset of PRESETS) {
      const requiresFoundational = preset.requiredSystemPacks.some((s) => foundational.has(s.packId));
      if (requiresFoundational) {
        expect(preset.knownLimitations.length, preset.id).toBeGreaterThan(0);
      }
    }
  });
});
