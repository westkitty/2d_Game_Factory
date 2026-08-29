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
 * Phase 10's five deep proof games (proofs/<preset-id>/, docs/proofs/PROOF_MATRIX.md),
 * each with a committed PROOF_CONTRACT.md, a real generated composition, and a
 * dedicated real-browser proof spec (packages/qa/proof-specs/*.ts, `npm run qa:proof`)
 * satisfying MASTER_PROJECT.md section 24's stricter per-proof acceptance bar - see
 * docs/architecture/PHASE10_PROOF_HANDOFF.md. Only these five may claim
 * 'proof-validated'.
 */
const PROOF_VALIDATED_IDS = ['chase-platformer', 'twin-stick-shooter', 'tower-defense', 'sokoban', 'idle-incremental'].sort();

/**
 * Phase 8's remaining representative demos (demos/<preset-id>/), each with a
 * real, committed browser smoke test (packages/qa/specs/*.ts) that passed
 * against system Chrome - see docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md.
 * Five of the original twelve graduated to 'proof-validated' in Phase 10
 * (above); the other seven stay 'smoke-validated'. Every other preset stays
 * 'recipe' until it earns the same real evidence.
 */
const SMOKE_VALIDATED_IDS = [
  'traditional-platformer',
  'metroidvania',
  'stealth-game',
  'bullet-hell',
  'top-down-racer',
  'turn-based-tactics',
  'visual-novel',
].sort();

describe('maturity honesty', () => {
  it('exactly Phase 10\'s five deep-proof presets are "proof-validated", nothing else', () => {
    const actual = PRESETS.filter((p) => p.maturity === 'proof-validated')
      .map((p) => p.id)
      .sort();
    expect(actual).toEqual(PROOF_VALIDATED_IDS);
  });

  it('exactly the remaining seven Phase 8 demo presets are "smoke-validated", nothing else', () => {
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

  it('exactly 5 proof-validated, 7 smoke-validated and 62 recipe presets out of the full 74-preset catalog', () => {
    expect(PRESETS.length).toBe(74);
    expect(PRESETS.filter((p) => p.maturity === 'proof-validated').length).toBe(5);
    expect(PRESETS.filter((p) => p.maturity === 'smoke-validated').length).toBe(7);
    expect(PRESETS.filter((p) => p.maturity === 'recipe').length).toBe(62);
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
    { id: 'twin-stick-shooter', pattern: /spatial\/analog aim/ },
    { id: 'stealth-game', pattern: /vision cones, awareness geometry, noise propagation and hiding are not implemented/ },
    { id: 'heist-game', pattern: /vision cones, awareness geometry, noise propagation and hiding are not implemented/ },
    { id: 'horizontal-shmup', pattern: /does not wire enemy formations/ },
    { id: 'vertical-shmup', pattern: /does not wire enemy formations/ },
    { id: 'bullet-hell', pattern: /Per-bullet GPU-scale pooling/ },
    { id: 'run-and-gun', pattern: /Enemy encounter orchestration/ },
    { id: 'boss-rush', pattern: /Sequencing multiple bosses/ },
    // Phase 7B (MASTER_PROJECT.md section 9)
    { id: 'match-puzzle', pattern: /match-detection\/cascade board rules are consumed by this recipe/ },
    { id: 'falling-block-puzzle', pattern: /No reusable falling-piece\/line-clear board engine/ },
    { id: 'breakout', pattern: /No reusable ball\/paddle collision-and-bounce system/ },
    { id: 'pong', pattern: /No reusable ball\/paddle collision-and-bounce system/ },
    { id: 'rhythm-action', pattern: /No deterministic music-beat\/audio-synchronization system/ },
    { id: 'reaction-timing', pattern: /no specialized reaction-test flow is implemented/ },
    { id: 'tower-defense', pattern: /keyboard grid cursor/ },
    { id: 'tower-defense', pattern: /route-following pathfinding is reusable/ },
    { id: 'lane-defense', pattern: /Lane-spawn scheduling and combat resolution are still starter-specific/ },
    { id: 'auto-battler', pattern: /autonomous combat orchestration is not implemented/ },
    { id: 'simple-rts', pattern: /box-select drag input and a command-card UI are still starter-specific/ },
    { id: 'turn-based-tactics', pattern: /Line-of-fire occlusion and multi-unit turn ordering are still starter-specific/ },
    { id: 'base-defense', pattern: /base-damage\/target-priority/ },
    { id: 'territory-control', pattern: /Reusable capture-zone\/territory ownership\/scoring mechanics/ },
    // Phase 7C (MASTER_PROJECT.md section 11)
    { id: 'idle-incremental', pattern: /offline-progress\/catch-up, prestige, and large economy balancing/ },
    { id: 'shopkeeper', pattern: /No complete customer AI, demand\/economy model/ },
    { id: 'tycoon-lite', pattern: /No complete customer AI, demand\/economy model/ },
    { id: 'restaurant', pattern: /No complete customer AI, demand\/economy model/ },
    { id: 'farming-lite', pattern: /No reusable crop-growth\/season\/plot-interaction system/ },
    { id: 'pet-creature', pattern: /No reusable needs\/behavior\/relationship\/creature simulation/ },
    { id: 'virtual-pet', pattern: /No reusable needs\/behavior\/relationship\/creature simulation/ },
    { id: 'aquarium-terrarium', pattern: /No reusable needs\/behavior\/relationship\/creature simulation/ },
    { id: 'colony-lite', pattern: /needs, assignment AI, construction placement and colony simulation are not/ },
    { id: 'visual-novel', pattern: /no full content-authored branching dialogue renderer/ },
    { id: 'point-and-click', pattern: /no full content-authored branching dialogue renderer/ },
    { id: 'interactive-fiction-hybrid', pattern: /No dedicated parser\/text-command system/ },
    { id: 'investigation-game', pattern: /No evidence-board\/deduction\/linking system/ },
    { id: 'museum-exhibit', pattern: /No dedicated exhibit\/codex presentation framework/ },
    { id: 'escape-room', pattern: /No content-authored escape-room puzzle grammar/ },
    { id: 'microgame-collection', pattern: /No microgame scheduler\/rotation\/meta-framework/ },
    { id: 'local-party-game', pattern: /Same-device multi-touch multiplayer is NOT implemented/ },
    { id: 'dress-up-character-toy', pattern: /No wardrobe\/attachment system is built on the drag/ },
    { id: 'sandbox-playground', pattern: /No generalized authoring\/editing sandbox/ },
    { id: 'drawing-game', pattern: /No canvas-stroke\/drawing capture is built on the spatial pointer/ },
    { id: 'fishing-game', pattern: /No reusable casting\/line\/tension\/fish behavior system/ },
    { id: 'cooking-game', pattern: /No reusable ingredient\/recipe\/action-sequence cooking system/ },
    { id: 'photography-game', pattern: /No reusable camera\/framing\/scoring\/photo-capture gameplay system/ },
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
