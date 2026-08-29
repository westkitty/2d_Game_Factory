import './styles.css';
import { createGame } from '@sw2d/runtime';
import {
  aiPack,
  arcadePack,
  combatPack,
  entityRegistryPack,
  narrativePack,
  progressionPack,
  puzzlePack,
  simulationPack,
  strategyPack,
  worldPack,
  itemsPack,
  weaponsPack,
  encountersPack,
  navigationPack,
  puzzleRulesPack,
  generationPack,
  runsPack,
} from '@sw2d/packs';
import { packConfigValidator } from '@sw2d/schemas';
import { gameContent } from './content.ts';
import { GAME_DEFINITION } from './game.ts';
import { GAME_SPECIFIC_PACK } from './game-specific/shellPack.ts';
import { PACK_CONFIG } from './game-specific/packConfig.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const touchControls = document.querySelector<HTMLElement>('#touch-controls');

if (!gameRoot) throw new Error('#game-root is missing from index.html');

const runtime = await createGame({
  definition: GAME_DEFINITION,
  content: gameContent,
  parent: gameRoot,
  packs: [
    combatPack,
    aiPack,
    worldPack,
    entityRegistryPack,
    progressionPack,
    arcadePack,
    puzzlePack,
    simulationPack,
    narrativePack,
    strategyPack,
    itemsPack,
    weaponsPack,
    encountersPack,
    navigationPack,
    puzzleRulesPack,
    generationPack,
    runsPack,
    GAME_SPECIFIC_PACK,
  ],
  packConfigValidator,
  packConfig: PACK_CONFIG,
});

function syncTouchControls(): void {
  if (!touchControls) return;
  touchControls.hidden = !runtime.context.accessibility.touchControlsVisible;
}

syncTouchControls();
runtime.context.events.on('settings:changed', syncTouchControls);
