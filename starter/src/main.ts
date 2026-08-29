import './styles.css';
import { SCENE_KEYS } from '@sw2d/contracts';
import { createGame } from '@sw2d/runtime';
import { packConfigValidator } from '@sw2d/schemas';
import { starterContent } from './content.ts';
import { STARTER_GAME } from './game.ts';
import { PLACEHOLDER_MOVER_PACK } from './game-specific/placeholderMoverPack.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const touchControls = document.querySelector<HTMLElement>('#touch-controls');
const startOverlay = document.querySelector<HTMLElement>('#start-overlay');

if (!gameRoot) throw new Error('#game-root is missing from index.html');

const runtime = await createGame({
  definition: STARTER_GAME,
  content: starterContent,
  parent: gameRoot,
  packs: [PLACEHOLDER_MOVER_PACK],
  // Every pack that declares a configSchemaId is validated before it
  // installs. A generated game supplies this so a declared schema cannot be
  // silently unenforced (ADR-0013).
  packConfigValidator,
});

/**
 * Touch controls are presentation, so the game owns them. The runtime only
 * reports whether they should be visible; showing them is a DOM concern.
 */
function syncTouchControls(): void {
  if (!touchControls) return;
  touchControls.hidden = !runtime.context.accessibility.touchControlsVisible;
}

syncTouchControls();
runtime.context.events.on('settings:changed', syncTouchControls);

// The visible Start control belongs on the title only. Clicking/tapping it is
// an ordinary semantic CONFIRM press (data-sw2d-action), so this only shows and
// hides the button - it is not a second start path. Fail-visible: shown until a
// run actually begins.
function syncStartOverlay(sceneKey: string): void {
  if (!startOverlay) return;
  startOverlay.hidden = sceneKey !== SCENE_KEYS.title;
}

runtime.context.events.on('scene:changed', ({ to }) => syncStartOverlay(to));
runtime.context.events.on('run:started', () => syncStartOverlay(SCENE_KEYS.play));

// Surface boot failures instead of leaving a blank canvas.
window.addEventListener('error', (event) => {
  console.error('[sw2d] uncaught error', event.error ?? event.message);
});
