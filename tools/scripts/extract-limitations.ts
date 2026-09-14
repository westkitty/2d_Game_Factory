#!/usr/bin/env node
/**
 * The zero-limitations gate for the Final Product Completion program
 * (docs/architecture/FINAL_PRODUCT_COMPLETION_MATRIX.md).
 *
 * Extracts every `knownLimitations` entry from the live catalog - every
 * preset, every entry, never the one-per-recipe table in
 * docs/presets/PRESET_CATALOG.md - and classifies each remaining sentence.
 * Only two classes may remain at the end of the program:
 *
 *   - `hardware`: physical-device certification the agent cannot perform
 *     (the software support is implemented and synthetically tested);
 *   - `license`: the user-owned public-license choice.
 *
 * Anything else is a machine-executable product limitation, and the gate
 * exits non-zero so it cannot be reported as complete.
 */
import { PRESETS } from '@sw2d/presets';

export type LimitationClass = 'hardware' | 'license' | 'machine-executable';

const HARDWARE = /physical (controller|gamepad|device|hardware)|real[- ]device certification/i;
const LICENSE = /public[- ]license|UNLICENSED/i;

export function classify(text: string): LimitationClass {
  if (HARDWARE.test(text)) return 'hardware';
  if (LICENSE.test(text)) return 'license';
  return 'machine-executable';
}

export interface ExtractedLimitation {
  readonly presetId: string;
  readonly text: string;
  readonly kind: LimitationClass;
}

export function extractLimitations(): readonly ExtractedLimitation[] {
  const out: ExtractedLimitation[] = [];
  for (const preset of PRESETS) {
    for (const text of preset.knownLimitations) out.push({ presetId: preset.id, text, kind: classify(text) });
  }
  return out;
}

function main(): number {
  const all = extractLimitations();
  const distinct = new Set(all.map((l) => l.text));
  const machine = all.filter((l) => l.kind === 'machine-executable');
  for (const preset of PRESETS) {
    if (preset.knownLimitations.length === 0) continue;
    console.log(`## ${preset.id}`);
    for (const text of preset.knownLimitations) console.log(`  [${classify(text)}] ${text}`);
  }
  console.log(
    `\nentries=${all.length} distinct=${distinct.size} presets=${PRESETS.length} machine-executable=${machine.length} hardware=${all.filter((l) => l.kind === 'hardware').length} license=${all.filter((l) => l.kind === 'license').length}`,
  );
  if (machine.length > 0) {
    console.log(`\nZERO-LIMITATIONS GATE: FAIL (${machine.length} machine-executable limitation(s) remain).`);
    return 1;
  }
  console.log('\nZERO-LIMITATIONS GATE: PASS (no machine-executable limitation remains).');
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  process.exit(main());
}
