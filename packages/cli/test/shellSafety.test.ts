import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source pins for two gameplay bugs found by actually playing generated
 * games (Arena finish program, adversarial sweep C). Both fixes live inside
 * Phaser-scene closures that unit tests cannot execute - the real proof is
 * the played session recorded in the ledger - so these tests pin the
 * *conditions* in source the way docsSync pins docs: reverting either fix
 * fails here with an explanation instead of silently resurrecting the bug.
 */

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

describe('generated-shell gameplay safety pins (sweep C)', () => {
  it('vehicle shell resets an off-world vehicle (service-integrated motion bypasses Arcade world bounds)', () => {
    // Bug: the vehicle service integrates x/y itself and the shell copies
    // them with setPosition, so setCollideWorldBounds never applies and the
    // car could drive off the world forever (seen at y=-881 while playing).
    const template = read('packages/cli/src/templates/gameSpecific/vehicleShellPack.ts');
    expect(template).toContain('vehicleSvc.reset()');
    expect(template, 'the off-world check must compare against the viewport, not a constant world').toMatch(
      /st\.x < -margin \|\| st\.x > width \+ margin \|\| st\.y < -margin \|\| st\.y > height \+ margin/,
    );
  });

  it("starter survival loop restarts on cleared enemies only - never gated on the player's own live projectiles", () => {
    // Bug: `&& projectiles.liveCount === 0` stalled the wave loop forever
    // for a player who held the fire button, because their own shots kept
    // liveCount above zero (found playing generated arena-combat:
    // encounterComplete true, enemiesAlive 0, wavesCleared stuck at 0).
    const source = read('packages/runtime/src/game-support/starterEncounters.ts');
    const restartGate = source.match(/if \((.*)\) \{\s*\n\s*wavesCleared \+= 1;/);
    expect(restartGate, 'the survival-loop restart condition should exist').not.toBeNull();
    expect(restartGate![1]).toBe('sequenceIds.length === 0 && encounter.completed && enemies.size === 0');
  });
});
