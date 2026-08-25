import './styles.css';
import { createGame } from '@sw2d/runtime';
import { starterContent } from './content.ts';
import { STARTER_GAME } from './game.ts';
import { PLACEHOLDER_MOVER_PACK } from './game-specific/placeholderMoverPack.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const touchControls = document.querySelector<HTMLElement>('#touch-controls');

if (!gameRoot) throw new Error('#game-root is missing from index.html');

const runtime = await createGame({
  definition: STARTER_GAME,
  content: starterContent,
  parent: gameRoot,
  packs: [PLACEHOLDER_MOVER_PACK],
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

// Surface boot failures instead of leaving a blank canvas.
window.addEventListener('error', (event) => {
  console.error('[sw2d] uncaught error', event.error ?? event.message);
});
