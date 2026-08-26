import type { GameDefinition } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import { PLACEHOLDER_MOVER_PACK } from './game-specific/placeholderMoverPack.ts';
import gameData from '../content/game.json' with { type: 'json' };

/**
 * The declarative description of this game, loaded from JSON and validated
 * against the GameDefinition schema before anything else touches it. A
 * malformed content/game.json fails right here, with a located error,
 * instead of surfacing later at whatever line first reads a bad field.
 */
export const STARTER_GAME: GameDefinition = validateDocumentOrThrow<GameDefinition>(
  'game-definition',
  'content/game.json',
  gameData,
);

// A schema can check shape; it cannot know which packs a specific game wires
// up. This is the game's own responsibility, not the validator's.
if (!STARTER_GAME.systemPacks.some((selection) => selection.packId === PLACEHOLDER_MOVER_PACK.id)) {
  throw new Error(
    `content/game.json must select system pack "${PLACEHOLDER_MOVER_PACK.id}" ` +
      '(main.ts installs it directly and expects the definition to agree).',
  );
}
