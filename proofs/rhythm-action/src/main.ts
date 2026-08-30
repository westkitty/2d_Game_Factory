import './styles.css';
import { SCENE_KEYS, type GameExtension } from '@sw2d/contracts';
import { createGame, ManualAudioTransport } from '@sw2d/runtime';
import {
  arcadePack,
  combatPack,
  entityRegistryPack,
  progressionPack,
  rhythmPack,
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
 * The game supplies the transport (Phase 17). This proof supplies a *scripted*
 * one so the browser journey can sit at an exact chart position and press there:
 * a rhythm assertion measured against a free-running clock would be a timing
 * race, not a proof. `ManualAudioTransport` is the same `AudioTransport`
 * contract the browser transport implements, with the clock supplied rather than
 * sampled.
 */
const transport = new ManualAudioTransport();

const transportExtension: GameExtension = {
  id: 'proof.audio-transport',
  setup(context) {
    context.capabilities.provide('audio.transport', transport);
  },
};

const runtime = await createGame({
  definition: GAME_DEFINITION,
  content: gameContent,
  parent: gameRoot,
  packs: [combatPack, worldPack, entityRegistryPack, progressionPack, arcadePack, rhythmPack, GAME_SPECIFIC_PACK],
  packConfigValidator,
  packConfig: PACK_CONFIG,
  extensions: [transportExtension],
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
