import { describe, expect, it } from 'vitest';
import { PRESETS } from '@sw2d/presets';
import { generateUiCopy } from '../src/generator/contentDocuments.ts';

/**
 * The generated playHint is a *claim about controls*. The adversarial sweep
 * that created this file caught the hint fabricating an INTERACT control the
 * top-down shell never reads - exactly the class of dishonesty the factory's
 * honesty tests exist to prevent. So: every control word a hint may use is
 * pinned here to the set of actions the shells actually consume, with the
 * real default bindings (packages/runtime/src/input/defaultBindings.ts).
 *
 * If a hint wants to name a new control, the shell must read it first, and
 * this allowlist must be updated in the same change.
 */

// Control vocabulary the hints may use -> why it is true.
//  - MOVE / STEER / THROTTLE / ARROWS / WASD: every controller family reads MOVE_*.
//  - JUMP: platform controller (JUMP: Space/KeyW/ArrowUp).
//  - FIRE J/X: PRIMARY_ACTION keyboard bindings are KeyJ/KeyX.
//  - AIM WITH MOUSE: topDownShellPack consumes aimFromPointer (ADR-0018).
//  - UNDO BACKSPACE: CANCEL is Backspace; gridShellPack calls puzzle.undo() on CANCEL.
//  - RESET K: SECONDARY_ACTION is KeyK/KeyC; gridShellPack calls puzzle.reset().
//  - ENTER: CONFIRM is Enter/Space/NumpadEnter; vehicle shell starts the race,
//    ui-simulation shell confirms the selection.
//  - PAUSE: the pause overlay is runtime-owned and always available.
const ALLOWED_HINT_WORDS = /^[A-Z0-9\/() .-]+$/;
const FORBIDDEN_CLAIMS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /INTERACT/, reason: 'no generated shell reads the INTERACT action' },
  { pattern: /DRAG/, reason: 'the pointer shell hit-tests hover/click; it has no drag interaction' },
  { pattern: /GAMEPAD|STICK/, reason: 'gamepad honesty: the starter does not claim device support it cannot prove' },
];

describe('generateUiCopy (generated games announce their genre honestly)', () => {
  const copyFor = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)!;
    return generateUiCopy({
      displayName: 'Example Game',
      presetDisplayName: preset.displayName,
      primaryControllerFamily: preset.controllerFamilies[0]!,
      requiredPackIds: preset.requiredSystemPacks.map((s) => s.packId),
    });
  };

  it('produces title/subtitle/playHint for every preset without ever fabricating a control', () => {
    for (const preset of PRESETS) {
      const copy = copyFor(preset.id);
      expect(copy.title).toBe('EXAMPLE GAME');
      expect(copy.subtitle).toBe(preset.displayName);
      expect(copy.playHint!.length).toBeGreaterThan(0);
      expect(copy.playHint, `${preset.id} playHint has unexpected characters`).toMatch(ALLOWED_HINT_WORDS);
      for (const { pattern, reason } of FORBIDDEN_CLAIMS) {
        expect(copy.playHint, `${preset.id}: ${reason}`).not.toMatch(pattern);
      }
      // Only the platform shell has a jump. A shmup telling the player to
      // jump is the exact bug this function exists to fix.
      if (preset.controllerFamilies[0] !== 'platform') {
        expect(copy.playHint, `${preset.id} is ${preset.controllerFamilies[0]} but hints JUMP`).not.toContain('JUMP');
      }
    }
  });

  it('tells an encounter-family player about the battle, and a weaponless one nothing about firing', () => {
    expect(copyFor('vertical-shmup').playHint).toContain('SURVIVE THE WAVES');
    expect(copyFor('vertical-shmup').playHint).toContain('FIRE J/X');
    expect(copyFor('twin-stick-shooter').playHint).toContain('FIRE J/X');
    expect(copyFor('twin-stick-shooter').playHint).not.toContain('SURVIVE');
    expect(copyFor('top-down-adventure').playHint).not.toContain('FIRE');
  });

  it('names only real bindings for the puzzle, racing and menu families', () => {
    expect(copyFor('sokoban').playHint).toBe('MOVE / PUSH WASD/ARROWS  -  UNDO BACKSPACE  -  RESET K');
    expect(copyFor('time-trial-racer').playHint).toContain('ENTER STARTS THE RACE');
    expect(copyFor('visual-novel').playHint).toContain('ENTER ADVANCES');
    expect(copyFor('shopkeeper').playHint).toContain('ENTER SERVES');
    expect(copyFor('restaurant').playHint).toContain('K RESTOCKS OR COOKS');
    expect(copyFor('pet-creature').playHint).toContain('J FEEDS');
    expect(copyFor('virtual-pet').playHint).toContain('J FEEDS');
    expect(copyFor('stealth-game').playHint).toContain('AVOID THE CONE');
    expect(copyFor('heist-game').playHint).toContain('AVOID THE CONE');
    expect(copyFor('breakout').playHint).toContain('RETURN THE BALL');
    expect(copyFor('pong').playHint).toContain('P1 ARROWS');
    expect(copyFor('local-party-game').playHint).toContain('PASS THE KEYBOARD');
    expect(copyFor('action-adventure').playHint).toContain('STRIKE J/X');
    expect(copyFor('arena-combat').playHint).toContain('STRIKE J/X');
  });
});
