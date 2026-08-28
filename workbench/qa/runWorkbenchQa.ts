/**
 * `npm run qa:workbench` - the repeatable real-browser workbench suite.
 *
 * One system-Chrome session drives the whole product through its own visible
 * controls, in a fixed order, against committed project-owned fixtures.
 * Journeys share a session because starting Chrome and a host per journey
 * would triple the runtime for no extra evidence; each still reports its own
 * PASS/FAIL and its own one-line evidence.
 *
 * Reports incomplete, never "success", when no system Chrome is available -
 * the same rule the inherited QA commands follow.
 */

import { findSystemChrome } from '@sw2d/qa';
import { JourneyFailure, startWorkbenchSession, type WorkbenchSession } from './harness.ts';
import { wbBoot001, wbDerive001, wbImage001, wbReimport001, wbReopen001, wbSeed001 } from './journeys/core.ts';
import { wbMulti001, wbOverlap001, wbScene001, wbSheet001 } from './journeys/editing.ts';
import { wbBatch001, wbBuild001, wbProvenance001, wbRemix001, wbResponsive001, wbSecurity001 } from './journeys/pipeline.ts';

interface Journey {
  readonly id: string;
  readonly title: string;
  run(context: { session: WorkbenchSession; note: (text: string) => void }): Promise<void>;
}

/**
 * Order matters: WB-IMAGE-001 creates the project the editing, scene and
 * pipeline journeys then work on, which is also the honest shape of the
 * product - you make something, then you refine it.
 */
const JOURNEYS: readonly Journey[] = [
  { id: 'WB-BOOT-001', title: 'the root command opens the workbench, not the foundation slice', run: wbBoot001 },
  { id: 'WB-IMAGE-001', title: 'one image becomes a real game whose rendered texture is that image', run: wbImage001 },
  { id: 'WB-SEED-001', title: 'game seeds are offered with honest maturity and coverage', run: wbSeed001 },
  { id: 'WB-DERIVE-001', title: 'derivation is non-destructive, recorded and undoable', run: wbDerive001 },
  { id: 'WB-REIMPORT-001', title: 'a replaced source keeps its identity, role and lineage', run: wbReimport001 },
  { id: 'WB-MULTI-001', title: 'bulk import tolerates mixed naming and catches duplicates', run: wbMulti001 },
  { id: 'WB-SHEET-001', title: 'Dex Sprite compiles a validated frame set and assigns frame 1', run: wbSheet001 },
  { id: 'WB-SCENE-001', title: 'a real level can be edited visually and still validates', run: wbScene001 },
  { id: 'WB-OVERLAP-001', title: 'a covered scene object stays selectable', run: wbOverlap001 },
  { id: 'WB-REOPEN-001', title: 'project state survives a reload', run: wbReopen001 },
  { id: 'WB-BUILD-001', title: 'validate, build and pack run from buttons and produce release evidence', run: wbBuild001 },
  { id: 'WB-PROVENANCE-001', title: 'unknown provenance blocks a release until it is resolved', run: wbProvenance001 },
  { id: 'WB-REMIX-001', title: 'an existing generated project can be adopted and its art swapped', run: wbRemix001 },
  { id: 'WB-BATCH-001', title: 'a medium asset pack imports with bounded concurrency', run: wbBatch001 },
  { id: 'WB-SECURITY-001', title: 'the local host is loopback-only with a narrow, non-executable API', run: wbSecurity001 },
  { id: 'WB-RESPONSIVE-001', title: 'the workbench holds together at three viewports', run: wbResponsive001 },
];

interface Outcome {
  readonly id: string;
  readonly title: string;
  readonly passed: boolean;
  readonly evidence: string;
  readonly durationMs: number;
  readonly failure?: string;
}

async function main(): Promise<number> {
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith('-'));

  if (!findSystemChrome()) {
    console.error('Workbench QA is INCOMPLETE: no system Chrome found (see `npm run sw2d -- doctor`).');
    return 1;
  }

  const selected = only.length > 0 ? JOURNEYS.filter((journey) => only.some((id) => journey.id.includes(id.toUpperCase()))) : JOURNEYS;
  if (selected.length === 0) {
    console.error(`No journey matches ${only.join(', ')}. Known: ${JOURNEYS.map((journey) => journey.id).join(', ')}`);
    return 1;
  }

  console.log(`\nWorkbench QA - ${selected.length} real-browser journey(s), system Chrome.\n`);

  const session = await startWorkbenchSession();
  const outcomes: Outcome[] = [];

  try {
    for (const journey of selected) {
      const startedAt = Date.now();
      let evidence = '';
      const note = (text: string): void => {
        evidence = text;
      };
      process.stdout.write(`  ${journey.id.padEnd(20)} ${journey.title}\n`);
      try {
        await journey.run({ session, note });
        outcomes.push({ id: journey.id, title: journey.title, passed: true, evidence, durationMs: Date.now() - startedAt });
        console.log(`  ${' '.repeat(20)} PASS  ${evidence}\n`);
      } catch (error) {
        const failure = error instanceof JourneyFailure ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        outcomes.push({ id: journey.id, title: journey.title, passed: false, evidence, durationMs: Date.now() - startedAt, failure });
        console.log(`  ${' '.repeat(20)} FAIL  ${failure}\n`);
      }
    }
  } finally {
    await session.close();
  }

  const passed = outcomes.filter((outcome) => outcome.passed).length;
  console.log('─'.repeat(78));
  for (const outcome of outcomes) {
    console.log(`  ${outcome.passed ? 'PASS' : 'FAIL'}  ${outcome.id.padEnd(20)} ${(outcome.durationMs / 1000).toFixed(1)}s  ${outcome.passed ? outcome.evidence : outcome.failure}`);
  }
  console.log('─'.repeat(78));
  console.log(`  ${passed}/${outcomes.length} workbench journeys passed.\n`);

  return passed === outcomes.length ? 0 : 1;
}

process.exitCode = await main();
