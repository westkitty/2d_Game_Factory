import './styles.css';
import { SCENE_KEYS } from '@sw2d/contracts';
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
  strategyActionsPack,
} from '@sw2d/packs';
import { packConfigValidator } from '@sw2d/schemas';
import { gameContent } from './content.ts';
import { GAME_DEFINITION } from './game.ts';
import { GAME_SPECIFIC_PACK } from './game-specific/shellPack.ts';
import { PACK_CONFIG } from './game-specific/packConfig.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const touchControls = document.querySelector<HTMLElement>('#touch-controls');
const startOverlay = document.querySelector<HTMLElement>('#start-overlay');

if (!gameRoot) throw new Error('#game-root is missing from index.html');

const runtime = await createGame({
  definition: GAME_DEFINITION,
  content: gameContent,
  parent: gameRoot,
  // Every real @sw2d/packs core is *available* here; content/game.json's
  // systemPacks controls which of them actually install (SystemHostImpl
  // only installs what a selection names).
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
    strategyActionsPack,
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

function syncStartOverlay(sceneKey: string): void {
  if (!startOverlay) return;
  startOverlay.hidden = sceneKey !== SCENE_KEYS.title;
}

runtime.context.events.on('scene:changed', ({ to }) => syncStartOverlay(to));
runtime.context.events.on('run:started', () => syncStartOverlay(SCENE_KEYS.play));

window.addEventListener('error', (event) => {
  console.error('[sw2d]', event.error ?? event.message);
});
