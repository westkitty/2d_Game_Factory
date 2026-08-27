import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveContained } from '../../workbench/server/paths.ts';
import { starterKitScaffoldFor } from '../../workbench/server/starterKits/scaffolds.ts';

const presetId = process.argv[2];
if (!presetId) {
  console.error('Usage: npm run starter-kits:bootstrap -- <preset-id>');
  process.exitCode = 1;
} else {
  const scaffold = starterKitScaffoldFor(presetId);
  if (!scaffold) {
    console.error(`No expansion scaffold exists for "${presetId}". Use npm run starter-kits:status.`);
    process.exitCode = 1;
  } else {
    const target = resolveContained(REPO_ROOT, scaffold.implementationPath);
    if (existsSync(target)) {
      console.error(`Refusing to overwrite existing starter-kit source: ${scaffold.implementationPath}`);
      process.exitCode = 1;
    } else {
      const shellPackId = `game.${scaffold.presetId}.starter`;
      const proofs = scaffold.mechanicProofs.map((proof) => ` * - ${proof}`).join('\n');
      const notes = scaffold.implementationNotes.length > 0
        ? scaffold.implementationNotes.map((note) => ` * - ${note}`).join('\n')
        : ' * - No extra scaffold note; preserve the preset known limitations.';
      const source = `/**
 * Expanded starter kit: ${scaffold.presetId}
 *
 * Target loop: ${scaffold.loop}
 * Reference kit: ${scaffold.referenceKit}
 * Current preset maturity: ${scaffold.currentMaturity} (DO NOT change it here)
 *
 * Mechanic proofs required before registration:
${proofs}
 *
 * Architecture notes:
${notes}
 *
 * This file is intentionally NOT auto-registered. Finish the implementation,
 * add focused + real-browser proof, then export it from expanded/index.ts.
 */
import type { StarterKit } from '../contracts.ts';
import { buildStarterKitOverlay } from '../authoring.ts';

const SHELL = \`import type { InstalledSystemPack } from '@sw2d/contracts';
import type { SceneContext, ScenePackDefinition } from '@sw2d/runtime';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: '${shellPackId}',
  version: '0.1.0',
  provides: [],
  dependencies: [],
  install(_context: SceneContext): InstalledSystemPack {
    throw new Error('TODO: implement ${scaffold.presetId} starter mechanics before registering this kit.');
  },
};
\`;

export const starterKit: StarterKit = {
  presetId: ${JSON.stringify(scaffold.presetId)},
  depth: 'rich-starter-kit',
  loop: ${JSON.stringify(scaffold.loop)},
  usefulRoles: ${JSON.stringify(scaffold.usefulRoles)},
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    return buildStarterKitOverlay({
      gameId,
      displayName,
      shellPackId: ${JSON.stringify(shellPackId)},
      shellSource: SHELL,
      systemPacks: ${JSON.stringify(scaffold.requiredPackIds.map((packId) => ({ packId })))},
      level: { entities: [], solids: [] },
      tuning: {},
    });
  },
};
`;
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source, 'utf8');
      console.log(`Created ${scaffold.implementationPath}`);
      console.log(`Next: implement ${scaffold.mechanicProofs.length} mechanic proof(s), validate in a real generated game, then register it.`);
    }
  }
}
