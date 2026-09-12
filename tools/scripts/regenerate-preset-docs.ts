#!/usr/bin/env node
/**
 * Regenerate the mechanical tables in docs/presets/PRESET_CATALOG.md and
 * docs/presets/PRESET_CAPABILITY_MATRIX.md from the live catalog.
 *
 * `packages/presets/test/docsSync.test.ts` fails the moment those tables drift
 * from `packages/presets/src/catalog/*.ts`. The prose around the tables is
 * hand-written and preserved; only the per-family tables, the "Key
 * limitations by recipe" table and the pack-consumer coverage table are
 * rewritten. Run after any catalog change: `npm run docs:presets`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '@sw2d/presets';
import { CAPABILITY_IDS, PACK_IDS } from '@sw2d/packs/ids';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const CATALOG_DOC = path.join(REPO_ROOT, 'docs/presets/PRESET_CATALOG.md');
const MATRIX_DOC = path.join(REPO_ROOT, 'docs/presets/PRESET_CAPABILITY_MATRIX.md');

const FAMILY_HEADINGS: ReadonlyArray<readonly [string, string]> = [
  ['platforming', '## Platforming (Phase 7A)'],
  ['top-down-action', '## Top-down action (Phase 7A)'],
  ['shooter', '## Shooter (Phase 7A)'],
  ['vehicle-movement', '## Vehicle / movement (Phase 7B)'],
  ['puzzle-arcade', '## Puzzle / arcade (Phase 7B)'],
  ['strategy-defense', '## Strategy / defense (Phase 7B)'],
  ['simulation-management', '## Simulation / management (Phase 7C)'],
  ['narrative-exploration', '## Narrative / exploration (Phase 7C)'],
  ['party-toy-weird', '## Party / toy / weird (Phase 7C)'],
];

const short = (packId: string): string => packId.replace('sw2d.', '');

/** Replace the table that directly follows `heading` (up to the next blank line after the table) with `table`. */
function replaceTableAfter(doc: string, heading: string, table: string): string {
  const start = doc.indexOf(heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const afterHeading = start + heading.length;
  const tableStart = doc.indexOf('\n|', afterHeading);
  if (tableStart < 0) throw new Error(`no table after ${heading}`);
  let tableEnd = tableStart + 1;
  while (tableEnd < doc.length) {
    const lineEnd = doc.indexOf('\n', tableEnd);
    const line = doc.slice(tableEnd, lineEnd < 0 ? doc.length : lineEnd);
    if (!line.startsWith('|')) break;
    tableEnd = lineEnd < 0 ? doc.length : lineEnd + 1;
  }
  return doc.slice(0, tableStart + 1) + table + doc.slice(tableEnd);
}

function catalogFamilyTable(family: string): string {
  const rows = PRESETS.filter((p) => p.family === family).map(
    (p) => `| \`${p.id}\` | ${p.displayName} | ${p.controllerFamilies.join(', ')} | ${p.requiredContentRoles.join(', ')} | ${p.maturity} |`,
  );
  return ['| id | display name | controller(s) | content roles | maturity |', '|---|---|---|---|---|', ...rows].join('\n') + '\n';
}

function limitationsTable(): string {
  const rows = PRESETS.map((p) => `| \`${p.id}\` | ${p.knownLimitations[0] ?? '(none stated)'} |`);
  return ['| id | most important current limitation |', '|---|---|', ...rows].join('\n') + '\n';
}

function matrixFamilyTable(family: string): string {
  const rows = PRESETS.filter((p) => p.family === family).map(
    (p) =>
      `| \`${p.id}\` | ${p.requiredSystemPacks.map((s) => short(s.packId)).join(', ') || '-'} | ${
        p.optionalSystemPacks.map((s) => short(s.packId)).join(', ') || '-'
      } | ${p.controllerFamilies.join(', ')} | ${p.supportedInputModes.join(', ')} | ${p.validationProfile} |`,
  );
  return (
    ['| id | required packs | optional packs | controller(s) | input modes | validation profile |', '|---|---|---|---|---|---|', ...rows].join(
      '\n',
    ) + '\n'
  );
}

function coverageTable(): string {
  const rows: string[] = [];
  for (const [key, packId] of Object.entries(PACK_IDS)) {
    const capability = (CAPABILITY_IDS as Record<string, string>)[key === 'worldEntities' ? 'entities' : key] ?? '?';
    const required = PRESETS.filter((p) => p.requiredSystemPacks.some((s) => s.packId === packId)).length;
    const referenced = PRESETS.filter((p) => [...p.requiredSystemPacks, ...p.optionalSystemPacks].some((s) => s.packId === packId)).length;
    rows.push(`| ${short(packId)} | \`${packId}\` | \`${capability}\` | ${required} | ${referenced} |`);
  }
  return (
    ['| short id | real pack id | capability id | recipes requiring it | recipes referencing it (required or optional) |', '|---|---|---|---|---|', ...rows].join(
      '\n',
    ) + '\n'
  );
}

function main(): void {
  let catalog = readFileSync(CATALOG_DOC, 'utf8');
  for (const [family, heading] of FAMILY_HEADINGS) catalog = replaceTableAfter(catalog, heading, catalogFamilyTable(family));
  catalog = replaceTableAfter(catalog, '## Key limitations by recipe', limitationsTable());
  writeFileSync(CATALOG_DOC, catalog);

  let matrix = readFileSync(MATRIX_DOC, 'utf8');
  for (const [family, heading] of FAMILY_HEADINGS) matrix = replaceTableAfter(matrix, heading, matrixFamilyTable(family));
  matrix = replaceTableAfter(matrix, '## Full pack-consumer coverage (all 74 recipes)', coverageTable());
  writeFileSync(MATRIX_DOC, matrix);
  console.log(`Regenerated ${path.relative(REPO_ROOT, CATALOG_DOC)} and ${path.relative(REPO_ROOT, MATRIX_DOC)} from ${PRESETS.length} presets / ${Object.keys(PACK_IDS).length} packs.`);
}

main();
