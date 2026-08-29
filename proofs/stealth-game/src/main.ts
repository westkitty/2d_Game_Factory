import './styles.css';
import { createGame } from '@sw2d/runtime';
import {
  aiPack,
  aiPerceptionPack,
  combatPack,
  navigationPack,
  worldPack,
} from '@sw2d/packs';
import { packConfigValidator } from '@sw2d/schemas';
import { gameContent } from './content.ts';
import { GAME_DEFINITION } from './game.ts';
import { GAME_SPECIFIC_PACK } from './game-specific/shellPack.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
if (!gameRoot) throw new Error('#game-root is missing from index.html');

await createGame({
  definition: GAME_DEFINITION,
  content: gameContent,
  parent: gameRoot,
  packs: [combatPack, aiPack, worldPack, navigationPack, aiPerceptionPack, GAME_SPECIFIC_PACK],
  packConfigValidator,
});

window.addEventListener('error', (event) => {
  console.error('[sw2d]', event.error ?? event.message);
});
