import type { StarterKit } from '../contracts.ts';
import { additionalPlatformStarterKit } from './builders/platformingMore.ts';

const baseStarterKit = additionalPlatformStarterKit('precision-platformer');

/**
 * The reference precision gauntlet has successive rises up to 75px. Its
 * original 390/1420 jump peaked at roughly 54px, making the authored route
 * physically impossible rather than merely precise. Preserve the narrow
 * platforms and void hazard, but give the generated player an ~88px apex and
 * enough horizontal travel to make each jump achievable with deliberate timing.
 *
 * Browser proof also showed the Tiny A -> Tiny B gap was horizontally too wide:
 * the player reached Tiny B's old x=465 only after falling below its landing
 * plane. Move only Tiny B 25px left, preserving its 68px width and the void, so
 * the second link is demanding but physically catchable during descent.
 */
export const starterKit: StarterKit = {
  ...baseStarterKit,
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    const files = new Map(baseStarterKit.overlay(gameId, displayName));

    const tuningPath = 'content/tuning.json';
    const tuningSource = files.get(tuningPath);
    if (!tuningSource) throw new Error('Precision Platformer starter is missing tuning content.');

    const tuning = JSON.parse(tuningSource) as {
      player: { moveSpeed: number; jumpVelocity: number; gravity: number };
    };
    tuning.player.moveSpeed = 195;
    tuning.player.jumpVelocity = 470;
    tuning.player.gravity = 1250;
    files.set(tuningPath, `${JSON.stringify(tuning, null, 2)}\n`);

    const levelPath = 'content/levels/main.json';
    const levelSource = files.get(levelPath);
    if (!levelSource) throw new Error('Precision Platformer starter is missing level content.');

    const level = JSON.parse(levelSource) as {
      layers: Array<{
        name: string;
        objects?: Array<{ name?: string; x: number }>;
      }>;
    };
    const solids = level.layers.find((layer) => layer.name === 'Solids');
    const tinyB = solids?.objects?.find((object) => object.name === 'Tiny B');
    if (!tinyB) throw new Error('Precision Platformer starter is missing Tiny B.');
    tinyB.x = 440;
    files.set(levelPath, `${JSON.stringify(level, null, 2)}\n`);

    return files;
  },
};
