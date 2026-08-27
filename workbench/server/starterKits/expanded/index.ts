import type { StarterKit } from '../contracts.ts';
import { starterKit as autoRunner } from './auto-runner.ts';
import { starterKit as bulletHell } from './bullet-hell.ts';
import { starterKit as metroidvania } from './metroidvania.ts';
import { starterKit as puzzlePlatformer } from './puzzle-platformer.ts';
import { starterKit as reactionTiming } from './reaction-timing.ts';
import { starterKit as shopkeeper } from './shopkeeper.ts';
import { starterKit as stealthGame } from './stealth-game.ts';
import { starterKit as timeTrialRacer } from './time-trial-racer.ts';
import { starterKit as topDownAdventure } from './top-down-adventure.ts';
import { starterKit as topDownRacer } from './top-down-racer.ts';
import { starterKit as traditionalPlatformer } from './traditional-platformer.ts';
import { starterKit as turnBasedTactics } from './turn-based-tactics.ts';
import { starterKit as tycoonLite } from './tycoon-lite.ts';
import { starterKit as visualNovel } from './visual-novel.ts';

/**
 * Post-proof rich starter kits that have passed canonical generation,
 * production build, real-browser boot, mechanic-specific browser proof, and
 * package-lock hygiene. Preset maturity remains unchanged; these entries alter
 * starter depth only.
 */
export const EXPANDED_STARTER_KITS: readonly StarterKit[] = Object.freeze([
  autoRunner,
  bulletHell,
  metroidvania,
  puzzlePlatformer,
  reactionTiming,
  shopkeeper,
  stealthGame,
  timeTrialRacer,
  topDownAdventure,
  topDownRacer,
  traditionalPlatformer,
  turnBasedTactics,
  tycoonLite,
  visualNovel,
]);
