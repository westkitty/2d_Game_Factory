import type { StarterKit } from '../contracts.ts';
import { additionalPlatformStarterKit } from './builders/platformingMore.ts';

const baseStarterKit = additionalPlatformStarterKit('precision-platformer');

/**
 * The reference precision gauntlet has successive rises up to 75px. Its
 * original 390/1420 jump peaked at roughly 54px, making the authored route
 * physically impossible rather than merely precise. Preserve the narrow
 * platforms and void hazard, but give the generated player an ~88px apex and
 * enough horizontal travel to make each jump achievable with deliberate timing.
 */
export const starterKit: StarterKit = {
  ...baseStarterKit,
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    const files = new Map(baseStarterKit.overlay(gameId, displayName));
    const tuningPath = 'content/tuning.json';
    const source = files.get(tuningPath);
    if (!source) throw new Error('Precision Platformer starter is missing tuning content.');

    const tuning = JSON.parse(source) as {
      player: { moveSpeed: number; jumpVelocity: number; gravity: number };
    };
    tuning.player.moveSpeed = 195;
    tuning.player.jumpVelocity = 470;
    tuning.player.gravity = 1250;
    files.set(tuningPath, `${JSON.stringify(tuning, null, 2)}\n`);
    return files;
  },
};
