import type { GenerationManifest, GenerationService, NormalizedLevel } from '@sw2d/contracts';
import { GENERATION_CAPABILITY_ID } from '@sw2d/contracts';
import type { SceneContext } from '../scenes/SceneContext.ts';

export interface ResolvedSceneLevel {
  readonly level: NormalizedLevel | undefined;
  /** Present only when `sw2d.generation` produced the level. */
  readonly manifest: GenerationManifest | undefined;
  /** True when a generator ran but its output failed validation and the authored level was used instead. */
  readonly generationRejected: boolean;
}

/**
 * Resolve the level a generated-game shell should build (capability program
 * Phase 7).
 *
 * When `sw2d.generation` is installed, run its `main` generator once from the
 * document seed and use the resulting `NormalizedLevel` - identical to what
 * the Tiled pipeline produces, so every downstream reader (solids, objects,
 * PlayerSpawn) is unchanged. Otherwise fall back to the hand-authored
 * `content/levels/<documentId>` document. A generator whose result fails its
 * own validation falls back too rather than handing gameplay a broken world.
 *
 * Pure with respect to scene resources: it registers nothing. The caller
 * contributes the returned manifest to `context.debug` and owns that handle.
 */
export function resolveSceneLevel(context: SceneContext, documentId = 'levels/main'): ResolvedSceneLevel {
  const authored = context.content.data[documentId]?.value as NormalizedLevel | undefined;
  const generation = context.capabilities.get<GenerationService>(GENERATION_CAPABILITY_ID);
  if (!generation) return { level: authored, manifest: undefined, generationRejected: false };
  const generators = generation.availableGenerators();
  if (generators.length === 0) return { level: authored, manifest: undefined, generationRejected: false };
  const generatorId = generators.includes('main') ? 'main' : generators[0]!;
  const result = generation.generate(generatorId);
  if (!result.validation.valid) {
    return { level: authored, manifest: result.manifest, generationRejected: true };
  }
  return { level: result.output, manifest: result.manifest, generationRejected: false };
}
