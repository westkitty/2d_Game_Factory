import type { GameDefinition } from '@sw2d/contracts';
import { PLACEHOLDER_MOVER_PACK } from './game-specific/placeholderMoverPack.ts';

/**
 * The declarative description of this game.
 *
 * Everything a normal game changes is here or in content.ts. Phase 2 moves this
 * shape into schema-validated JSON; the field names are already the ones the
 * schema will use.
 */
export const STARTER_GAME: GameDefinition = {
  id: 'sw2d-foundation-slice',
  displayName: 'SW2D Foundation Slice',
  version: '0.1.0',
  schemaVersion: 1,
  viewport: { width: 960, height: 540 },
  // Factory defaults apply for every action not restated here.
  bindings: {},
  systemPacks: [
    { packId: PLACEHOLDER_MOVER_PACK.id, config: {} },
  ],
  defaultSettings: {
    masterVolume: 0.7,
  },
};
