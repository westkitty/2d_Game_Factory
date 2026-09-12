import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PresetDefinition } from '@sw2d/contracts';
import { shellFileFor, shellPackId } from './controllerTemplates.ts';
import {
  generateGameManifest,
  generateItemCatalog,
  generateWeaponCatalog,
  generateEncounterCatalog,
  generatePuzzleRulesDoc,
  generateGenerationDoc,
  generateWorldGraphDoc,
  generateVehicleCatalog,
  generateRaceCatalog,
  generateEconomyCatalog,
  generateNeedsCatalog,
  generateDialogueCatalog,
  generatePerceptionCatalog,
  generateBallPaddleCatalog,
  generateMeleeCatalog,
  generateLocalPlayCatalog,
  generateStageScrollCatalog,
  generateTimingCatalog,
  generateWallCatalog,
  generateTerritoryCatalog,
  generatePinballCatalog,
  generateCameraCatalog,
  generateCodexCatalog,
  generateTargetingCatalog,
  generatePursuitCatalog,
  generateRunsCatalog,
  generateSimulationCatalog,
  generateResourceManifest,
  generateTiledLevel,
  generateTheme,
  generateTuning,
  generateUiCopy,
} from './contentDocuments.ts';
import { generatePackConfig } from './packConfig.ts';
import { generateReadme } from './readme.ts';
import { generateContentTest } from './testFile.ts';

const TEMPLATES_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../templates');

function readTemplate(relativePath: string): string {
  return readFileSync(path.join(TEMPLATES_ROOT, relativePath), 'utf8');
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build the full generated-game file tree for one preset, entirely in
 * memory - no filesystem writes. Keeping generation pure is what makes
 * determinism (MASTER_PROJECT.md section 10: same inputs, byte-identical
 * tree, every time) trivially testable: call this twice and diff the maps.
 */
export function buildGameFiles(gameId: string, preset: PresetDefinition): Map<string, string> {
  const displayName = titleCase(gameId);
  const shellFile = shellFileFor(preset.controllerFamilies);
  const shellPack = shellPackId(preset.controllerFamilies[0]!);
  const requiredPackIds = preset.requiredSystemPacks.map((s) => s.packId);

  const files = new Map<string, string>();

  files.set('package.json', readTemplate('package.json.template').replaceAll('__GAME_ID__', gameId).replaceAll('__PRESET_ID__', preset.id));
  files.set('tsconfig.json', readTemplate('tsconfig.json.template'));
  files.set('vite.config.ts', readTemplate('vite.config.ts.template'));
  files.set('index.html', readTemplate('index.html.template').replaceAll('__DISPLAY_NAME__', displayName));
  files.set('src/styles.css', readTemplate('styles.css.template'));
  files.set('src/main.ts', readTemplate('src/main.ts.template'));
  files.set('src/content.ts', readTemplate('src/content.ts.template').replaceAll('__GAME_ID__', gameId));
  files.set('src/game.ts', readTemplate('src/game.ts.template'));
  files.set('src/game-specific/shellPack.ts', readTemplate(`gameSpecific/${shellFile}`));
  files.set('src/game-specific/packConfig.ts', generatePackConfig(preset));

  files.set(
    'content/game.json',
    JSON.stringify(
      generateGameManifest({
        gameId,
        displayName,
        systemPackIds: requiredPackIds,
        shellPackId: shellPack,
        ...(preset.physicsProfile ? { physicsProfile: preset.physicsProfile } : {}),
      }),
      null,
      2,
    ) + '\n',
  );
  files.set('content/tuning.json', JSON.stringify(generateTuning(), null, 2) + '\n');
  files.set(
    'content/themes/default/theme.json',
    JSON.stringify(
      generateTheme(
        'default',
        'Default',
        generateUiCopy({
          displayName,
          presetDisplayName: preset.displayName,
          primaryControllerFamily: preset.controllerFamilies[0]!,
          requiredPackIds,
          presetId: preset.id,
        }),
      ),
      null,
      2,
    ) + '\n',
  );
  files.set('content/levels/main.json', JSON.stringify(generateTiledLevel(), null, 2) + '\n');
  files.set(
    'content/items.json',
    JSON.stringify(
      generateItemCatalog(
        !preset.requiredContentRoles.includes('items')
          ? 'none'
          : preset.id === 'kart-racer' || preset.id === 'endless-driving'
            ? 'kart'
            : 'coin',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/weapons.json',
    JSON.stringify(
      generateWeaponCatalog(requiredPackIds.includes('sw2d.weapons'), requiredPackIds.includes('sw2d.encounters')),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/encounters.json',
    JSON.stringify(
      generateEncounterCatalog(requiredPackIds.includes('sw2d.encounters'), {
        kind:
          preset.id === 'survivor-like'
            ? 'swarm'
            : preset.id === 'run-and-gun'
              ? 'platform'
              : preset.id === 'boss-rush'
                ? 'boss-rush'
                : preset.id === 'bullet-hell'
                  ? 'bullet-hell'
                : preset.id === 'gallery-shooter'
                  ? 'gallery'
                  : preset.id === 'rail-shooter'
                    ? 'rail'
                    : preset.id === 'horizontal-shmup'
                      ? 'shmup-h'
                      : preset.id === 'vertical-shmup'
                        ? 'shmup-v'
                        : preset.id === 'lane-defense'
                          ? 'lane'
                          : preset.id === 'base-defense'
                            ? 'hold'
                        : 'skirmish',
      }),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/puzzles.json',
    JSON.stringify(
      generatePuzzleRulesDoc(
        requiredPackIds.includes('sw2d.puzzle-rules')
          ? preset.id === 'match-puzzle'
            ? 'match'
            : preset.id === 'falling-block-puzzle'
              ? 'falling-block'
              : preset.id === 'physics-puzzle'
                ? 'physics-goal'
                : preset.id === 'escape-room'
                  ? 'escape'
                  : preset.controllerFamilies[0] === 'grid'
                    ? 'sokoban'
                    : 'switch-sequence'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/world-graph.json',
    JSON.stringify(generateWorldGraphDoc(requiredPackIds.includes('sw2d.world-graph')), null, 2) + '\n',
  );
  files.set(
    'content/generation.json',
    JSON.stringify(
      generateGenerationDoc(
        requiredPackIds.includes('sw2d.generation')
          ? preset.id === 'maze-game'
            ? 'maze'
            : preset.controllerFamilies[0] === 'vehicle'
              ? 'road-chain'
              : preset.controllerFamilies[0] === 'top-down' || preset.controllerFamilies[0] === 'grid'
                ? 'room-graph'
                : 'segment-chain'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/vehicles.json',
    JSON.stringify(
      generateVehicleCatalog(requiredPackIds.includes('sw2d.vehicles') ? preset.vehicleProfile ?? 'car' : 'none'),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/races.json',
    JSON.stringify(
      generateRaceCatalog(
        requiredPackIds.includes('sw2d.racing') ? (preset.id.includes('time-trial') ? 'time-trial' : 'race') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/economy.json',
    JSON.stringify(
      generateEconomyCatalog(
        requiredPackIds.includes('sw2d.economy')
          ? preset.id === 'restaurant'
            ? 'kitchen'
            : preset.id === 'tycoon-lite'
              ? 'factory'
              : 'shop'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/needs.json',
    JSON.stringify(
      generateNeedsCatalog(
        requiredPackIds.includes('sw2d.needs')
          ? preset.id === 'aquarium-terrarium'
            ? 'habitat'
            : preset.id === 'virtual-pet'
              ? 'companion'
              : preset.id === 'colony-lite'
                ? 'colony'
                : 'creature'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/dialogue.json',
    JSON.stringify(
      generateDialogueCatalog(
        requiredPackIds.includes('sw2d.dialogue')
          ? preset.id === 'point-and-click'
            ? 'adventure'
            : 'novel'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/perception.json',
    JSON.stringify(
      generatePerceptionCatalog(
        requiredPackIds.includes('sw2d.perception')
          ? preset.id === 'heist-game'
            ? 'heist'
            : 'infiltrate'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/ball-paddle.json',
    JSON.stringify(
      generateBallPaddleCatalog(
        requiredPackIds.includes('sw2d.ball-paddle') ? (preset.id === 'pong' ? 'pong' : 'breakout') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/melee.json',
    JSON.stringify(
      generateMeleeCatalog(
        requiredPackIds.includes('sw2d.melee') ? (preset.id === 'arena-combat' ? 'arena' : 'skirmish') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/local-play.json',
    JSON.stringify(
      generateLocalPlayCatalog(
        requiredPackIds.includes('sw2d.local-play') ? (preset.id === 'pong' ? 'versus' : 'hotseat') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/stage-scroll.json',
    JSON.stringify(
      generateStageScrollCatalog(
        requiredPackIds.includes('sw2d.stage-scroll')
          ? preset.id === 'vertical-shmup'
            ? 'vertical'
            : 'horizontal'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/timing.json',
    JSON.stringify(
      generateTimingCatalog(
        requiredPackIds.includes('sw2d.timing') ? (preset.id === 'rhythm-action' ? 'rhythm' : 'reaction') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/wall.json',
    JSON.stringify(
      generateWallCatalog(
        requiredPackIds.includes('sw2d.wall') ? (preset.id === 'climbing-game' ? 'slide' : 'leap') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/territory.json',
    JSON.stringify(
      generateTerritoryCatalog(
        requiredPackIds.includes('sw2d.territory') ? (preset.id === 'simple-rts' ? 'occupy' : 'stand') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/pinball.json',
    JSON.stringify(
      generatePinballCatalog(
        requiredPackIds.includes('sw2d.pinball') ? (preset.id === 'physics-toy' ? 'toy' : 'table') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/camera.json',
    JSON.stringify(
      generateCameraCatalog(
        requiredPackIds.includes('sw2d.camera') ? (preset.id === 'photography-game' ? 'frame' : 'rail') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/codex.json',
    JSON.stringify(
      generateCodexCatalog(
        requiredPackIds.includes('sw2d.codex') ? (preset.id === 'investigation-game' ? 'case' : 'exhibit') : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/targeting.json',
    JSON.stringify(
      generateTargetingCatalog(
        requiredPackIds.includes('sw2d.targeting')
          ? preset.id === 'auto-battler'
            ? 'auto'
            : preset.id === 'turn-based-tactics'
              ? 'range'
              : 'tower'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/pursuit.json',
    JSON.stringify(
      generatePursuitCatalog(
        requiredPackIds.includes('sw2d.pursuit')
          ? preset.id === 'chase-platformer'
            ? 'wall'
            : preset.id === 'auto-runner'
              ? 'chaser-course'
              : 'chaser'
          : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/runs.json',
    JSON.stringify(
      generateRunsCatalog(requiredPackIds.includes('sw2d.runs') ? (preset.id === 'action-roguelite' ? 'roguelite' : 'survive') : 'none'),
      null,
      2,
    ) + '\n',
  );
  files.set(
    'content/simulation.json',
    JSON.stringify(
      generateSimulationCatalog(
        preset.id === 'idle-incremental'
          ? 'idle'
          : preset.id === 'farming-lite'
            ? 'farm'
            : preset.id === 'colony-lite'
              ? 'colony'
            : preset.id === 'shopkeeper' || preset.id === 'tycoon-lite' || preset.id === 'restaurant'
              ? 'meta'
              : 'none',
      ),
      null,
      2,
    ) + '\n',
  );
  files.set('resources/RESOURCE_MANIFEST.json', JSON.stringify(generateResourceManifest(gameId), null, 2) + '\n');

  files.set('tests/content.test.ts', generateContentTest());
  files.set('README.md', generateReadme(gameId, displayName, preset));

  return files;
}

/** Write a previously-built file map to disk under `targetPath`, creating directories as needed. */
export function writeGameFiles(files: ReadonlyMap<string, string>, targetPath: string): void {
  for (const [relativePath, content] of files) {
    const fullPath = path.join(targetPath, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
}

/** No unresolved `__TOKEN__`-shaped placeholder remains in any generated file (MASTER_PROJECT.md section 10.4). */
export function findUnresolvedTokens(files: ReadonlyMap<string, string>): readonly string[] {
  const found = new Set<string>();
  const pattern = /__[A-Z_]+__/g;
  for (const content of files.values()) {
    for (const match of content.matchAll(pattern)) found.add(match[0]);
  }
  return [...found].sort();
}
