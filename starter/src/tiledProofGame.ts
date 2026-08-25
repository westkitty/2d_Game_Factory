import type { GameDefinition } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import { TILED_LEVEL_PACK } from './game-specific/tiledLevelPack.ts';
import gameData from '../content/tiled-proof-game.json';

/**
 * The Tiled-proof page's declarative game description, validated the same
 * way content/game.json is - see starter/src/game.ts.
 */
export const TILED_PROOF_GAME: GameDefinition = validateDocumentOrThrow<GameDefinition>(
  'game-definition',
  'content/tiled-proof-game.json',
  gameData,
);

if (!TILED_PROOF_GAME.systemPacks.some((selection) => selection.packId === TILED_LEVEL_PACK.id)) {
  throw new Error(
    `content/tiled-proof-game.json must select system pack "${TILED_LEVEL_PACK.id}" ` +
      '(tiledProofMain.ts installs it directly and expects the definition to agree).',
  );
}
