import './styles.css';
import { createGame } from '@sw2d/runtime';
import { entityRegistryPack, worldPack } from '@sw2d/packs';
import { packConfigValidator } from '@sw2d/schemas';
import { resolveTheme } from '@sw2d/content-pipeline';
import { tiledProofContent, selectedTheme } from './tiledProofContent.ts';
import { TILED_PROOF_GAME } from './tiledProofGame.ts';
import { TILED_LEVEL_PACK } from './game-specific/tiledLevelPack.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const touchControls = document.querySelector<HTMLElement>('#touch-controls');

if (!gameRoot) throw new Error('#game-root is missing from tiled-proof.html');

const runtime = await createGame({
  definition: TILED_PROOF_GAME,
  content: tiledProofContent,
  parent: gameRoot,
  packs: [worldPack, entityRegistryPack, TILED_LEVEL_PACK],
  packConfigValidator,
});

/**
 * Applies the selected theme's tokens as CSS custom properties on the root
 * element - the DOM half of "theme changes presentation, not gameplay".
 * highContrast re-resolves the same tokens through resolveTheme(), which is
 * exactly the accessibility/theme integration MASTER_PROJECT.md section 12
 * asks for: a real visual change, not just a persisted-but-unrendered flag.
 */
function applyThemeTokens(): void {
  const resolved = resolveTheme(selectedTheme, runtime.context.accessibility);
  const root = document.documentElement.style;
  root.setProperty('--sw2d-bg', resolved.tokens.background);
  root.setProperty('--sw2d-panel', resolved.tokens.panel);
  root.setProperty('--sw2d-panel-active', resolved.tokens.panelActive);
  root.setProperty('--sw2d-text', resolved.tokens.text);
  root.setProperty('--sw2d-accent', resolved.tokens.accent);
  root.setProperty('--sw2d-border', resolved.tokens.border);
  document.documentElement.style.fontFamily = selectedTheme.fonts.ui;
}

/**
 * Reduced motion has no motion effect to suppress yet in the runtime's own
 * scenes beyond the title prompt (OPERATIONAL_STATE.md's known limitation) -
 * but the theme/UI layer now introduces one: the touch-button active-state
 * transition. Honouring reducedMotion here is what keeps that new motion
 * inside the existing accessibility architecture instead of adding an
 * unguarded animation outside it.
 */
function applyMotionPreference(): void {
  document.documentElement.style.setProperty(
    '--sw2d-motion-duration',
    runtime.context.accessibility.reducedMotion ? '0ms' : '120ms',
  );
}

function syncTouchControls(): void {
  if (!touchControls) return;
  touchControls.hidden = !runtime.context.accessibility.touchControlsVisible;
}

applyThemeTokens();
applyMotionPreference();
syncTouchControls();
runtime.context.events.on('settings:changed', () => {
  applyThemeTokens();
  applyMotionPreference();
  syncTouchControls();
});
runtime.context.events.on('accessibility:changed', () => {
  applyThemeTokens();
  applyMotionPreference();
});

window.addEventListener('error', (event) => {
  console.error('[sw2d] uncaught error', event.error ?? event.message);
});
