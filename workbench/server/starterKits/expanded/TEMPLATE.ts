/**
 * Copy this file to `<preset-id>.ts` for one completed expanded starter kit.
 * Do not register the copy in `expanded/index.ts` until its real-browser proof
 * passes. Delete every TODO before promotion.
 */
import type { StarterKit } from '../contracts.ts';
import { buildStarterKitOverlay } from '../authoring.ts';

const SHELL = `// TODO: real game-specific ScenePackDefinition for this preset.\n`;

export const starterKit: StarterKit = {
  presetId: 'TODO-preset-id',
  depth: 'rich-starter-kit',
  loop: 'TODO: one sentence describing the real playable loop.',
  usefulRoles: ['player', 'background'],
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    return buildStarterKitOverlay({
      gameId,
      displayName,
      shellPackId: 'game.TODO-shell',
      shellSource: SHELL,
      systemPacks: [],
      level: { entities: [], solids: [] },
      tuning: {},
    });
  },
};
