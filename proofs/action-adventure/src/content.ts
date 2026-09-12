import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };
import weaponsData from '../content/weapons.json' with { type: 'json' };
import encountersData from '../content/encounters.json' with { type: 'json' };
import puzzlesData from '../content/puzzles.json' with { type: 'json' };
import generationData from '../content/generation.json' with { type: 'json' };
import worldGraphData from '../content/world-graph.json' with { type: 'json' };
import vehiclesData from '../content/vehicles.json' with { type: 'json' };
import racesData from '../content/races.json' with { type: 'json' };
import economyData from '../content/economy.json' with { type: 'json' };
import needsData from '../content/needs.json' with { type: 'json' };
import dialogueData from '../content/dialogue.json' with { type: 'json' };
import perceptionData from '../content/perception.json' with { type: 'json' };
import ballPaddleData from '../content/ball-paddle.json' with { type: 'json' };
import meleeData from '../content/melee.json' with { type: 'json' };
import localPlayData from '../content/local-play.json' with { type: 'json' };
import stageScrollData from '../content/stage-scroll.json' with { type: 'json' };
import timingData from '../content/timing.json' with { type: 'json' };
import wallData from '../content/wall.json' with { type: 'json' };
import territoryData from '../content/territory.json' with { type: 'json' };
import pinballData from '../content/pinball.json' with { type: 'json' };
import cameraData from '../content/camera.json' with { type: 'json' };
import codexData from '../content/codex.json' with { type: 'json' };
import targetingData from '../content/targeting.json' with { type: 'json' };

/**
 * The generated game's content source.
 *
 * Follows the same validated-JSON pattern `starter/src/content.ts` and
 * `starter/src/tiledProofContent.ts` establish: every document is schema-
 * validated before a ContentBundle is produced, so malformed content fails
 * here with a located error rather than wherever gameplay first touches a
 * bad field. Assets/UI/theme come from the local theme manifest
 * (content/themes/default/theme.json) - swap or add a theme with
 * `npm run sw2d -- add-theme proof-action-adventure <theme-id>`. Every generated game
 * ships one Tiled level (content/levels/main.json) so the Tiled pipeline is
 * always real, even for controller families whose shell does not read it -
 * add more with `npm run sw2d -- add-level proof-action-adventure <level-id>`.
 */
const theme: ThemeManifest = validateDocumentOrThrow<ThemeManifest>(
  'theme-manifest',
  'content/themes/default/theme.json',
  themeData,
);

export const gameContent: ContentSource = {
  id: (gameData as { id: string }).id,
  load: async (): Promise<ContentBundle> => {
    const normalizedLevel = normalizeTiledMap('main', rawLevel);
    const data = validateContentBundleData({ tuning: tuningData, 'levels/main': normalizedLevel, items: itemsData, weapons: weaponsData, encounters: encountersData, puzzles: puzzlesData, generation: generationData, 'world-graph': worldGraphData, vehicles: vehiclesData, races: racesData, economy: economyData, needs: needsData, dialogue: dialogueData, perception: perceptionData, 'ball-paddle': ballPaddleData, melee: meleeData, 'local-play': localPlayData, 'stage-scroll': stageScrollData, timing: timingData, wall: wallData, territory: territoryData, pinball: pinballData, camera: cameraData, codex: codexData, targeting: targetingData });

    const assets: readonly AssetDescriptor[] = theme.assets;
    const ui: Partial<UiCopy> | undefined = theme.ui;

    return {
      id: (gameData as { id: string }).id,
      schemaVersion: 1,
      assets,
      ...(theme.animations !== undefined ? { animations: theme.animations } : {}),
      ...(ui !== undefined ? { ui } : {}),
      data,
    };
  },
};
