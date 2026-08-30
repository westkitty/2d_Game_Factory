import './styles.css';
import { SCENE_KEYS } from '@sw2d/contracts';
import { createGame } from '@sw2d/runtime';
import { ManualWallClock } from '@sw2d/contracts';
import {
  arcadePack,
  combatPack,
  entityRegistryPack,
  progressionPack,
  simulationPack,
  economyPack,
  worldPack,
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

/**
 * A scripted wall clock instead of the browser's.
 *
 * Offline catch-up is the one thing in this game that reads real time, and a
 * proof that asserts on it against `Date.now()` would have to genuinely wait.
 * The clock is the same injected interface the browser one implements, so the
 * economy cannot tell the difference - which is the point.
 */
const wallClock = new ManualWallClock(1_000_000);

const runtime = await createGame({
  definition: GAME_DEFINITION,
  wallClock,
  content: gameContent,
  parent: gameRoot,
  packs: [
    combatPack,
    worldPack,
    entityRegistryPack,
    progressionPack,
    arcadePack,
    simulationPack,
    economyPack,
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
