import type { GameDefinition } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };

export const GAME_DEFINITION: GameDefinition = validateDocumentOrThrow<GameDefinition>(
  'game-definition',
  'content/game.json',
  gameData,
);
