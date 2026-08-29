import './styles.css';
import { SCENE_KEYS, type GamepadSnapshot } from '@sw2d/contracts';
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
 * Scripted gamepad seam for automated QA.
 *
 * `GamepadSource` is the injection point the Phase 15 contract defines precisely
 * so a disconnect can be exercised without hardware. This reads a plain array off
 * `window` on every poll, so the browser proof can plug, press and unplug a pad
 * deterministically. With nothing set it falls through to the real
 * `navigator.getGamepads()` reader, so a human opening this page uses real pads.
 */
declare global {
  interface Window {
    __SW2D_TEST_PADS__?: (GamepadSnapshot | null)[];
  }
}

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
    GAME_SPECIFIC_PACK,
  ],
  packConfigValidator,
  packConfig: PACK_CONFIG,
  gamepadSource: () => window.__SW2D_TEST_PADS__ ?? readRealPads(),
});

function readRealPads(): (GamepadSnapshot | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  const pads = navigator.getGamepads();
  if (!pads) return [];
  return Array.from(pads, (pad) =>
    pad
      ? {
          index: pad.index,
          connected: pad.connected,
          id: pad.id,
          mapping: pad.mapping,
          axes: Array.from(pad.axes),
          buttons: pad.buttons.map((button) => button.value),
        }
      : null,
  );
}

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
