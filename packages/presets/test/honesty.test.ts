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
 * `npm run qa:proof`. Phase 10 established the first five; the capability
 * program (Phases 1-10, ADR-0018..0027) added eighteen; the Arena finish
 * program reconciled the catalog with that evidence
 * (docs/architecture/ARENA_FACTORY_FINISH_STATE.md); the Category-C
 * convergence program (docs/architecture/CATEGORY_C_CONVERGENCE_MATRIX.md)
 * committed the proofs the Category-C waves had played but deferred, one
 * preset at a time, each promoted only after its proof passed `qa:proof`.
 * Only the ids below may claim 'proof-validated'. `proofEvidence.test.ts`
 * derives the same set mechanically from the proofs/ directory.
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
  // Category-C convergence - ui-simulation shell consumers (Waves 1/2/3/7/10/13/14/15/18/24/28/30).
  'shopkeeper',
  'restaurant',
  'tycoon-lite',
  'pet-creature',
  'aquarium-terrarium',
  'virtual-pet',
  'visual-novel',
  'local-party-game',
  'reaction-timing',
  'rhythm-action',
  'farming-lite',
  'colony-lite',
  'interactive-fiction-hybrid',
  'fishing-game',
  'cooking-game',
  'microgame-collection',
  'auto-battler',
  'pinball-lite',
  // Category-C convergence - top-down shell consumers (Waves 4/5/6/7/8/14/17/20/21/25/26/30/31).
  'stealth-game',
  'heist-game',
  'breakout',
  'pong',
  'action-adventure',
  'arena-combat',
  'horizontal-shmup',
  'vertical-shmup',
  'survivor-like',
  'action-roguelite',
  'investigation-game',
  'photography-game',
  'base-defense',
  'simple-rts',
  'territory-control',
  'museum-exhibit',
].sort();

/**
 * Phase 8's remaining representative demos (demos/<preset-id>/), each with a
 * real, committed browser smoke test (packages/qa/specs/*.ts) that passed
 * against system Chrome - see docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md.
 * Everything that has since earned a committed proof game graduated to
 * 'proof-validated' (above); these still have demo-level evidence only.
 * Every other preset stays 'recipe' until it earns the same real evidence.
 */
const SMOKE_VALIDATED_IDS = [
  'traditional-platformer',
].sort();

const TOTAL_PRESETS = 74;

describe('maturity honesty', () => {
  it('exactly the presets with committed passing proof games are "proof-validated", nothing else', () => {
    const actual = PRESETS.filter((p) => p.maturity === 'proof-validated')
      .map((p) => p.id)
      .sort();
    expect(actual).toEqual(PROOF_VALIDATED_IDS);
  });

  it('exactly the remaining Phase 8 demo presets without a proof game are "smoke-validated", nothing else', () => {
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

  it('the pinned lists partition the full 74-preset catalog (no preset unaccounted for, no overlap)', () => {
    expect(PRESETS.length).toBe(TOTAL_PRESETS);
    const overlap = PROOF_VALIDATED_IDS.filter((id) => SMOKE_VALIDATED_IDS.includes(id));
    expect(overlap).toEqual([]);
    expect(PRESETS.filter((p) => p.maturity === 'proof-validated').length).toBe(PROOF_VALIDATED_IDS.length);
    expect(PRESETS.filter((p) => p.maturity === 'smoke-validated').length).toBe(SMOKE_VALIDATED_IDS.length);
    expect(PRESETS.filter((p) => p.maturity === 'recipe').length).toBe(
      TOTAL_PRESETS - PROOF_VALIDATED_IDS.length - SMOKE_VALIDATED_IDS.length,
    );
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
    { id: 'maze-game', pattern: /Grid pathfinding and walkable occupancy are reusable/ },
    { id: 'auto-battler', pattern: /autonomous strikes are reusable \(sw2d\.targeting\)/ },
    { id: 'chase-platformer', pattern: /chase\/pursuit-pressure/ },
    { id: 'simple-rts', pattern: /box-select for the generated starter is a two-unit presentation/ },
    { id: 'turn-based-tactics', pattern: /turn-action state machine is still starter-specific/ },
    { id: 'base-defense', pattern: /target-priority/ },
    { id: 'territory-control', pattern: /Capture-zone occupancy is reusable \(sw2d\.territory\)/ },
    // Phase 7C (MASTER_PROJECT.md section 11)
    { id: 'idle-incremental', pattern: /offline-progress\/catch-up, prestige, and large economy balancing/ },
    { id: 'shopkeeper', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'tycoon-lite', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'restaurant', pattern: /Customer demand, queue, stock, transactions and production jobs are reusable/ },
    { id: 'farming-lite', pattern: /crop growth and season rotation for the generated starter/ },
    { id: 'pet-creature', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'virtual-pet', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'aquarium-terrarium', pattern: /Needs, decay, care actions, affinity and wellbeing hold\/fail are reusable/ },
    { id: 'colony-lite', pattern: /Resource ledger and timed jobs are reusable \(sw2d\.simulation\); colonist pathfinding is reusable \(sw2d\.navigation, optional\); needs, assignment AI and construction placement are not/ },
    { id: 'visual-novel', pattern: /Branching dialogue graphs, choices, flags and endings are reusable/ },
    { id: 'point-and-click', pattern: /Branching dialogue graphs, choices, flags and endings are reusable/ },
    { id: 'interactive-fiction-hybrid', pattern: /parser\/text-command/ },
    { id: 'investigation-game', pattern: /evidence-board\/deduction\/linking/ },
    { id: 'museum-exhibit', pattern: /Exhibit entries are reusable \(sw2d\.codex\)/ },
    { id: 'escape-room', pattern: /No content-authored escape-room puzzle grammar/ },
    { id: 'microgame-collection', pattern: /Wait\/go then mash rounds are a generated starter scheduler/ },
    { id: 'local-party-game', pattern: /Local hot-seat turns and simultaneous versus axes are reusable/ },
    { id: 'dress-up-character-toy', pattern: /Wardrobe slots for the generated starter use interaction drag\/drop/ },
    { id: 'sandbox-playground', pattern: /interaction click \(ADR-0018\)/ },
    { id: 'drawing-game', pattern: /Stroke polylines for the generated starter are captured through the spatial pointer/ },
    { id: 'survivor-like', pattern: /sw2d\.progression/ },
    { id: 'action-roguelite', pattern: /sw2d\.progression/ },
    { id: 'fishing-game', pattern: /casting\/line\/tension\/fish behavior system/ },
    { id: 'cooking-game', pattern: /ingredient\/recipe\/action-sequence cooking system/ },
    { id: 'photography-game', pattern: /spatial pointer \(ADR-0018\)/ },
    { id: 'asteroids-shooter', pattern: /sw2d\.weapons/ },
    { id: 'gallery-shooter', pattern: /sw2d\.weapons/ },
    { id: 'rail-shooter', pattern: /Fixed-path\/rail camera movement is reusable \(sw2d\.camera\)/ },
    { id: 'auto-runner', pattern: /climbing or chase-pressure/ },
    { id: 'endless-runner', pattern: /climbing or chase-pressure/ },
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
