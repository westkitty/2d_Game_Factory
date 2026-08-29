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
  // only installs what a selection names). Passing all ten plus this game's
  // own shell pack is what lets content/game.json enable any subset of the
  // preset's required/optional packs without editing this file.
  packs: [combatPack, aiPack, worldPack, entityRegistryPack, progressionPack, arcadePack, puzzlePack, simulationPack, narrativePack, strategyPack, itemsPack, GAME_SPECIFIC_PACK],
  // Every pack that declares a configSchemaId is validated before it installs
  // (ADR-0013) - see docs/architecture/adr/0013-composition-root-enforces-pack-declarations.md.
  packConfigValidator,
  // Config for packs that declare `configSource: 'code'` (functions, not JSON -
  // sw2d.puzzle today). content/game.json cannot carry these; src/game-specific/
  // can, and that is normal game work. See src/game-specific/packConfig.ts.
  packConfig: PACK_CONFIG,
});

function syncTouchControls(): void {
  if (!touchControls) return;
  touchControls.hidden = !runtime.context.accessibility.touchControlsVisible;
}

syncTouchControls();
runtime.context.events.on('settings:changed', syncTouchControls);

// The visible Start control belongs on the title only. Clicking/tapping it is
// an ordinary semantic CONFIRM press (data-sw2d-action), so this adds no second
// start path - it only shows and hides the button. Fail-visible: it stays shown
// until a run actually begins.
function syncStartOverlay(sceneKey: string): void {
  if (!startOverlay) return;
  startOverlay.hidden = sceneKey !== SCENE_KEYS.title;
}

runtime.context.events.on('scene:changed', ({ to }) => syncStartOverlay(to));
runtime.context.events.on('run:started', () => syncStartOverlay(SCENE_KEYS.play));

window.addEventListener('error', (event) => {
  console.error('[sw2d]', event.error ?? event.message);
});
