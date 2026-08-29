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
  generateResourceManifest,
  generateTiledLevel,
  generateTheme,
  generateTuning,
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
      generateGameManifest({ gameId, displayName, systemPackIds: requiredPackIds, shellPackId: shellPack }),
      null,
      2,
    ) + '\n',
  );
  files.set('content/tuning.json', JSON.stringify(generateTuning(), null, 2) + '\n');
  files.set('content/themes/default/theme.json', JSON.stringify(generateTheme('default', 'Default'), null, 2) + '\n');
  files.set('content/levels/main.json', JSON.stringify(generateTiledLevel(), null, 2) + '\n');
  files.set(
    'content/items.json',
    JSON.stringify(generateItemCatalog(preset.requiredContentRoles.includes('items')), null, 2) + '\n',
  );
  files.set(
    'content/weapons.json',
    JSON.stringify(generateWeaponCatalog(requiredPackIds.includes('sw2d.weapons')), null, 2) + '\n',
  );
  files.set(
    'content/encounters.json',
    JSON.stringify(generateEncounterCatalog(requiredPackIds.includes('sw2d.encounters')), null, 2) + '\n',
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
