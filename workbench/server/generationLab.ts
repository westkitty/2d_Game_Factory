/**
 * Procedural-generation authoring surface (capability program Phase 7).
 *
 * The smallest useful surface the Phase 7 spec asks for: pick a generator,
 * set a seed and the major parameters, regenerate, and read back a
 * reproducible manifest. It runs the same pure `runGenerator` from
 * `@sw2d/contracts` the runtime uses - deterministic, offline, no Phaser.
 *
 * It reads the game's committed `content/generation.json`; it never writes.
 * A creator regenerating with the same seed always gets the same manifest.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GenerationDoc, GeneratorConfig } from '@sw2d/contracts';
import { runGenerator, validateGenerationResult } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface GenerationPreviewRequest {
  readonly gameId: string;
  readonly generatorId?: string;
  readonly seed?: number;
  readonly size?: number;
  readonly difficulty?: number;
}

export interface GenerationPreviewResult {
  readonly generatorId: string;
  readonly generators: readonly { readonly id: string; readonly kind: string }[];
  readonly documentSeed: number;
  readonly effectiveSeed: number;
  readonly manifest: unknown;
  readonly validation: { readonly valid: boolean; readonly errors: readonly string[] };
  readonly output: { readonly solids: number; readonly objects: number };
}

function loadDoc(gameId: string): GenerationDoc {
  const file = path.join(gameRoot(gameId), 'content', 'generation.json');
  if (!existsSync(file)) throw new SecurityError(404, `No content/generation.json in "${gameId}".`);
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  // Same schema gate the runtime's content source uses.
  const validated = validateContentBundleData({ generation: raw });
  return validated.generation!.value as GenerationDoc;
}

export function previewGeneration(req: GenerationPreviewRequest): GenerationPreviewResult {
  const doc = loadDoc(req.gameId);
  const generators = doc.generators.map((g) => ({ id: g.id, kind: g.kind }));
  if (generators.length === 0) throw new SecurityError(400, 'content/generation.json defines no generators.');

  const chosenId = req.generatorId ?? generators[0]!.id;
  const config = doc.generators.find((g) => g.id === chosenId);
  if (!config) throw new SecurityError(400, `No generator "${chosenId}".`);

  const documentSeed = Math.abs(Math.trunc(doc.seed)) >>> 0;
  const effectiveSeed = req.seed !== undefined ? Math.abs(Math.trunc(req.seed)) >>> 0 : subSeed(documentSeed, chosenId);
  const overrides: { size?: number; difficulty?: number } = {};
  if (typeof req.size === 'number' && Number.isFinite(req.size)) overrides.size = Math.trunc(req.size);
  if (typeof req.difficulty === 'number' && Number.isFinite(req.difficulty)) overrides.difficulty = Math.trunc(req.difficulty);

  const result = runGenerator(config as { id: string } & GeneratorConfig, effectiveSeed, 'main', overrides);
  const revalidation = validateGenerationResult(result);
  return {
    generatorId: chosenId,
    generators,
    documentSeed,
    effectiveSeed,
    manifest: result.manifest,
    validation: {
      valid: result.validation.valid && revalidation.valid,
      errors: [...result.validation.errors, ...revalidation.errors],
    },
    output: { solids: result.output.solids.length, objects: result.output.objects.length },
  };
}

/** Same per-generator sub-seed derivation the pack uses when no explicit seed is given. */
function subSeed(base: number, generatorId: string): number {
  let h = base >>> 0;
  for (let i = 0; i < generatorId.length; i++) {
    h ^= generatorId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
