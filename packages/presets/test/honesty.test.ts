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
  // Category-C convergence - pointer / grid / platform / vehicle shell consumers.
  'physics-puzzle',
  'escape-room',
  'drawing-game',
  'dress-up-character-toy',
  'sandbox-playground',
  'rail-shooter',
  'match-puzzle',
  'falling-block-puzzle',
  'maze-game',
  'precision-platformer',
  'climbing-game',
  'auto-runner',
  'traditional-platformer',
  'asteroids-shooter',
  'endless-driving',
  'boat-flight-racer',
  'kart-racer',
].sort();

/**
 * Phase 8's representative demos (demos/<preset-id>/) once held three presets
 * at 'smoke-validated' on demo-level evidence alone. Every one of them has
 * since earned a committed proof game and graduated to 'proof-validated'
 * (above), so this list is empty - kept so the partition below stays explicit
 * and a future demo-only preset has somewhere honest to go.
 */
const SMOKE_VALIDATED_IDS: readonly string[] = [];

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

describe('closed limitations stay closed (Final Product Completion program)', () => {
  /**
   * Every `knownLimitations` sentence the Final Product Completion program
   * closed (docs/architecture/FINAL_PRODUCT_COMPLETION_MATRIX.md) was closed
   * by shipping the behaviour in the generated game, not by rewording. This
   * list is the regression guard: none of these gaps may be re-declared. The
   * inverse of the pre-program "required limitations" list, which pinned the
   * exact opposite (MASTER_PROJECT.md section 12) while the gaps were real.
   */
  const CLOSED: ReadonlyArray<{ readonly id: string; readonly pattern: RegExp; readonly closedBy: string }> = [
    { id: 'chase-platformer', pattern: /chase\/pursuit-pressure pack is not/, closedBy: 'L01 sw2d.pursuit' },
    { id: 'endless-runner', pattern: /climbing or chase-pressure system is not/, closedBy: 'L02 sw2d.pursuit chaser' },
    { id: 'auto-runner', pattern: /climbing or chase-pressure system is not/, closedBy: 'L02 sw2d.pursuit chaser' },
    { id: 'precision-platformer', pattern: /ledge-grab and a full parkour grammar are not/, closedBy: 'L03 sw2d.wall ledges' },
    { id: 'climbing-game', pattern: /ledge-grab and a full parkour grammar are not/, closedBy: 'L03 sw2d.wall ledges' },
    { id: 'action-adventure', pattern: /combo strings, directional attacks and targeting UI are not/, closedBy: 'L04 sw2d.melee combos' },
    { id: 'arena-combat', pattern: /combo strings, directional attacks and targeting UI are not/, closedBy: 'L04 sw2d.melee combos' },
    { id: 'twin-stick-shooter', pattern: /ships no enemy waves out of the box/, closedBy: 'L05 encounters required' },
    { id: 'survivor-like', pattern: /repeats the authored encounter without escalating it/, closedBy: 'L06 escalation + sw2d.runs' },
    { id: 'dungeon-crawler', pattern: /generated Enemy objects from the room graph and AI behaviour are not wired/, closedBy: 'L07 bindStarterDungeon' },
    { id: 'action-roguelite', pattern: /permadeath and between-run loadouts are not a reusable capability/, closedBy: 'L08 sw2d.runs' },
    { id: 'stealth-game', pattern: /patrol pathfinding, takedowns and full stealth AI are not/, closedBy: 'L09 sw2d.perception AI' },
    { id: 'heist-game', pattern: /patrol pathfinding, takedowns and full stealth AI are not/, closedBy: 'L09 sw2d.perception AI' },
    { id: 'boss-rush', pattern: /Sequencing multiple bosses across a run is starter-specific/, closedBy: 'L10 encounter sequence' },
    { id: 'horizontal-shmup', pattern: /rail-path cameras, parallax authoring and bullet-hell pooling are not/, closedBy: 'L11 stage-scroll layers + rail' },
    { id: 'vertical-shmup', pattern: /rail-path cameras, parallax authoring and bullet-hell pooling are not/, closedBy: 'L11 stage-scroll layers + rail' },
    { id: 'bullet-hell', pattern: /Per-bullet GPU-scale pooling/, closedBy: 'L12 pooled projectile runtime + qa:bullet-budget' },
    { id: 'asteroids-shooter', pattern: /Drifting rock fields and wrap-around collision stay game-specific/, closedBy: 'L13 bindStarterAsteroids' },
    { id: 'asteroids-shooter', pattern: /not rotational-inertia physics/, closedBy: 'L14 sw2d.vehicles ship profile' },
    { id: 'gallery-shooter', pattern: /stay in the frozen proof/, closedBy: 'L15 bindStarterGallery' },
    { id: 'run-and-gun', pattern: /this recipe does not install it/, closedBy: 'L16 encounters required on the platform shell' },
    { id: 'rail-shooter', pattern: /does not wire sw2d\.weapons/, closedBy: 'L17 bindStarterGallery rail' },
    { id: 'kart-racer', pattern: /Holding and firing a kart item on demand/, closedBy: 'L18 sw2d.items held slot' },
    { id: 'endless-driving', pattern: /a reusable kart item-fire system is not/, closedBy: 'L19 held items + road traffic' },
    { id: 'match-puzzle', pattern: /pointer drag-swap, wall-kicks and overlay-local boards are not/, closedBy: 'L21/L22 pointer swap + wall kicks' },
    { id: 'match-puzzle', pattern: /this grid-family recipe does not consume it/, closedBy: 'L22 spatial pointer drag-swap' },
    { id: 'falling-block-puzzle', pattern: /pointer drag-swap, wall-kicks and overlay-local boards are not/, closedBy: 'L21 wall kicks' },
    { id: 'breakout', pattern: /a full pinball table is not/, closedBy: 'L23/L28 pinball table complete' },
    { id: 'pong', pattern: /a full pinball table is not/, closedBy: 'L23/L28 pinball table complete' },
    { id: 'pinball-lite', pattern: /Matter presentation stays on physics-toy/, closedBy: 'L28 pinball balls/drain/game-over' },
    { id: 'maze-game', pattern: /fog-of-war, minimap and authored maze generation are not/, closedBy: 'L26 maze generation + fog' },
    { id: 'boat-flight-racer', pattern: /not fluid or aerodynamic simulation/, closedBy: 'L20 arcade boat/flight loop' },
    { id: 'physics-puzzle', pattern: /this puzzle's own rules stay game-specific TypeScript/, closedBy: 'L25 physics-goal content' },
    { id: 'escape-room', pattern: /this puzzle's own rules stay game-specific TypeScript/, closedBy: 'L25/L46 escape content grammar' },
    { id: 'escape-room', pattern: /No content-authored escape-room puzzle grammar exists yet/, closedBy: 'L46 escape kind' },
    { id: 'rhythm-action', pattern: /a deterministic music-beat\/audio-synchronization system is not/, closedBy: 'L27 audio transport' },
    { id: 'reaction-timing', pattern: /a deterministic music-beat\/audio-synchronization system is not/, closedBy: 'L27 reaction rounds' },
  ];

  CLOSED.forEach(({ id, pattern, closedBy }) => {
    it(`${id} no longer declares a limitation closed by ${closedBy}`, () => {
      const preset = PRESETS.find((p) => p.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.knownLimitations.some((limitation) => pattern.test(limitation)), preset!.knownLimitations.join(' | ')).toBe(false);
    });
  });

  it('the closed pattern list names only real presets', () => {
    for (const { id } of CLOSED) expect(PRESETS.some((p) => p.id === id), id).toBe(true);
  });
});
