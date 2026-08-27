import { allStarterKitScaffolds } from '../../workbench/server/starterKits/scaffolds.ts';
import { starterKitFor } from '../../workbench/server/starterKits/index.ts';

const rows = allStarterKitScaffolds()
  .map((scaffold) => ({ ...scaffold, implemented: Boolean(starterKitFor(scaffold.presetId)) }))
  .sort((a, b) => Number(a.implemented) - Number(b.implemented) || a.priority - b.priority || a.family.localeCompare(b.family) || a.presetId.localeCompare(b.presetId));

const remaining = rows.filter((row) => !row.implemented);
console.log(`Starter-kit expansion: ${rows.length - remaining.length}/${rows.length} scaffolded presets implemented; ${remaining.length} remaining.`);
let currentFamily = '';
for (const row of rows) {
  if (row.family !== currentFamily) {
    currentFamily = row.family;
    console.log(`\n${currentFamily}`);
  }
  console.log(`${row.implemented ? '[DONE]' : `[P${row.priority}]`} ${row.presetId} -> ${row.implementationPath} (ref: ${row.referenceKit})`);
}
