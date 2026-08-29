/**
 * Physics-profile authoring surface (capability program Phase 9).
 *
 * The smallest useful surface: report which physics backend the game uses
 * (`content/game.json`'s `physicsProfile`) and, for the Matter backend, the
 * world gravity the runtime applies. Arcade is the default; switching to
 * Matter is a one-line edit to `content/game.json`. Read-only.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface PhysicsProfileResult {
  readonly profile: 'arcade' | 'matter';
  readonly matterGravity: { readonly x: number; readonly y: number } | null;
  /** Bodies/constraints authored per-game come from game-specific code, not content - noted for the panel. */
  readonly note: string;
}

export function inspectPhysics(gameId: string): PhysicsProfileResult {
  const file = path.join(gameRoot(gameId), 'content', 'game.json');
  if (!existsSync(file)) throw new SecurityError(404, `No content/game.json in "${gameId}".`);
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { physicsProfile?: string };
  const profile: 'arcade' | 'matter' = raw.physicsProfile === 'matter' ? 'matter' : 'arcade';
  return {
    profile,
    matterGravity: profile === 'matter' ? { x: 0, y: 1 } : null,
    note:
      profile === 'matter'
        ? 'Matter backend enabled. Rigid bodies, constraints and grapple are the reusable AdvancedPhysicsService / GrappleService, wired in src/game-specific/.'
        : 'Arcade backend (default). Set "physicsProfile": "matter" in content/game.json to enable rigid bodies / constraints / grapple.',
  };
}
