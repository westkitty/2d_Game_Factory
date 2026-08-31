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
  navigationPack,
  defensePack,
  weaponsPack,
  autoCombatPack,
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
  // Every real @sw2d/packs core is *available* here; content/game.json's
  // systemPacks controls which of them actually install (SystemHostImpl
  // only installs what a selection names). Passing all ten plus this game's
  // own shell pack is what lets content/game.json enable any subset of the
  // preset's required/optional packs without editing this file.
  packs: [combatPack, aiPack, worldPack, entityRegistryPack, progressionPack, arcadePack, puzzlePack, simulationPack, narrativePack, strategyPack, navigationPack, weaponsPack, defensePack, autoCombatPack, GAME_SPECIFIC_PACK],
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

window.addEventListener('error', (event) => {
  console.error('[sw2d]', event.error ?? event.message);
});
