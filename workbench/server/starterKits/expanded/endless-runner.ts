import type { StarterKit } from '../contracts.ts';
import { additionalPlatformStarterKit } from './builders/platformingMore.ts';

const baseStarterKit = additionalPlatformStarterKit('endless-runner');

/**
 * Endless Runner is the beginner auto-scroll example. Keep the shared special-
 * platform mechanics, but position its one teaching obstacle so the authored
 * default jump arc has a readable, forgiving timing window after the score
 * pickup. This changes only generated game content, not shared runtime policy.
 */
export const starterKit: StarterKit = {
  ...baseStarterKit,
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    const files = new Map(baseStarterKit.overlay(gameId, displayName));
    const levelPath = 'content/levels/main.json';
    const source = files.get(levelPath);
    if (!source) throw new Error('Endless Runner starter is missing its authored level.');

    const level = JSON.parse(source) as {
      layers: Array<{
        type: string;
        name: string;
        objects?: Array<{ class?: string; x?: number; y?: number; width?: number; height?: number }>;
      }>;
    };
    const entities = level.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'Entities');
    const hazard = entities?.objects?.find((object) => object.class === 'Hazard');
    if (!hazard) throw new Error('Endless Runner starter is missing its teaching hazard.');

    hazard.x = 500;
    hazard.y = 488;
    hazard.width = 28;
    hazard.height = 12;
    files.set(levelPath, `${JSON.stringify(level, null, 2)}\n`);
    return files;
  },
};
