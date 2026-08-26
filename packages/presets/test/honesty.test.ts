import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/index.ts';

/**
 * Honesty checks MASTER_PROJECT.md sections 5, 12/9 and 13 require directly:
 * maturity never overstated, gamepad never claimed, and the specific
 * recipes the master plan names (Phase 7A section 12, Phase 7B section 9)
 * must carry their required knownLimitations text.
 */

describe('maturity honesty', () => {
  it('every preset is maturity "recipe" - Phase 8/10 own smoke/proof validation, not this phase', () => {
    for (const preset of PRESETS) {
      expect(preset.maturity, preset.id).toBe('recipe');
    }
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
    { id: 'grappling-platformer', pattern: /rope\/constraint\/grappling physics/ },
    { id: 'twin-stick-shooter', pattern: /spatial\/analog aim/ },
    { id: 'stealth-game', pattern: /vision cones, awareness geometry, noise propagation, hiding, and patrol navigation/ },
    { id: 'heist-game', pattern: /vision cones, awareness geometry, noise propagation, hiding, and patrol navigation/ },
    { id: 'horizontal-shmup', pattern: /projectile\/weapon systems/ },
    { id: 'vertical-shmup', pattern: /projectile\/weapon systems/ },
    { id: 'bullet-hell', pattern: /projectile\/weapon systems/ },
    { id: 'run-and-gun', pattern: /projectile\/weapon systems/ },
    { id: 'gallery-shooter', pattern: /Spatial pointer targeting is not yet implemented/ },
    { id: 'rail-shooter', pattern: /Spatial pointer targeting is not yet implemented/ },
    { id: 'boss-rush', pattern: /boss-phase orchestration is not yet a production system/ },
    // Phase 7B (MASTER_PROJECT.md section 9)
    { id: 'top-down-racer', pattern: /no reusable vehicle-physics\/drift\/handling system/ },
    { id: 'kart-racer', pattern: /no reusable vehicle-physics\/drift\/handling system/ },
    { id: 'time-trial-racer', pattern: /no reusable vehicle-physics\/drift\/handling system/ },
    { id: 'endless-driving', pattern: /No procedural level\/segment generation exists yet/ },
    { id: 'boat-flight-racer', pattern: /No reusable buoyancy\/altitude\/flight model exists yet/ },
    { id: 'sokoban', pattern: /not JSON-serializable data/ },
    { id: 'match-puzzle', pattern: /No reusable match-detection\/cascade board rules/ },
    { id: 'falling-block-puzzle', pattern: /No reusable falling-piece\/line-clear board engine/ },
    { id: 'breakout', pattern: /No reusable ball\/paddle collision-and-bounce system/ },
    { id: 'pong', pattern: /No reusable ball\/paddle collision-and-bounce system/ },
    { id: 'physics-puzzle', pattern: /Optional advanced rigid-body\/constraint physics has not been implemented/ },
    { id: 'pinball-lite', pattern: /Optional advanced rigid-body\/constraint physics has not been implemented/ },
    { id: 'rhythm-action', pattern: /No deterministic music-beat\/audio-synchronization system/ },
    { id: 'reaction-timing', pattern: /no specialized reaction-test flow is implemented/ },
    { id: 'tower-defense', pattern: /Spatial placement\/hover targeting is not implemented/ },
    { id: 'tower-defense', pattern: /pathfinding\/route-following\/targeting\/upgrade-tower system/ },
    { id: 'lane-defense', pattern: /No reusable lane-spawn\/route\/combat-resolution system/ },
    { id: 'auto-battler', pattern: /autonomous combat orchestration is not implemented/ },
    { id: 'simple-rts', pattern: /Spatial selection\/command targeting and pathfinding are not implemented/ },
    { id: 'turn-based-tactics', pattern: /movement range, attack range, pathfinding, and turn-action resolution/ },
    { id: 'base-defense', pattern: /Wave spawning\/targeting\/base-damage orchestration/ },
    { id: 'territory-control', pattern: /Reusable capture-zone\/territory ownership\/scoring mechanics/ },
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
    // combat, ai, puzzle and (Phase 7B) strategy are explicitly "foundational core, not a full
    // genre system" (see each pack's own doc comment - strategyPack.ts: "the minimal turn/team/
    // selection basis future strategy systems build on ... no pathfinding ... RTS commands") -
    // any preset requiring one honestly has at least one limitation.
    const foundational = new Set(['sw2d.combat', 'sw2d.ai', 'sw2d.puzzle', 'sw2d.strategy']);
    for (const preset of PRESETS) {
      const requiresFoundational = preset.requiredSystemPacks.some((s) => foundational.has(s.packId));
      if (requiresFoundational) {
        expect(preset.knownLimitations.length, preset.id).toBeGreaterThan(0);
      }
    }
  });
});
