import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/index.ts';

/**
 * Honesty checks MASTER_PROJECT.md sections 5, 12 and 13 require directly:
 * maturity never overstated, gamepad never claimed, and the specific
 * recipes the master plan names must carry their required knownLimitations
 * text.
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
  ];

  for (const { id, pattern } of cases) {
    it(`${id} states its required limitation`, () => {
      const preset = PRESETS.find((p) => p.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.knownLimitations.some((limitation) => pattern.test(limitation)), preset!.knownLimitations.join(' | ')).toBe(
        true,
      );
    });
  }

  it('no preset has an empty knownLimitations array while depending on a foundational (non-genre-complete) pack', () => {
    // combat, ai and puzzle are explicitly "foundational core, not a full genre system" (see each
    // pack's own doc comment) - any preset requiring one honestly has at least one limitation.
    const foundational = new Set(['sw2d.combat', 'sw2d.ai', 'sw2d.puzzle']);
    for (const preset of PRESETS) {
      const requiresFoundational = preset.requiredSystemPacks.some((s) => foundational.has(s.packId));
      if (requiresFoundational) {
        expect(preset.knownLimitations.length, preset.id).toBeGreaterThan(0);
      }
    }
  });
});
