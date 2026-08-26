import type { GameDefinition } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };

/**
 * The declarative description of this game, loaded from JSON and validated
 * against the GameDefinition schema before anything else touches it - the
 * same pattern starter/src/game.ts establishes.
 */
export const GAME_DEFINITION: GameDefinition = validateDocumentOrThrow<GameDefinition>(
  'game-definition',
  'content/game.json',
  gameData,
);
