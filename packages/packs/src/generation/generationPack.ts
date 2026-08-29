import type {
  GameContext,
  GenerationDoc,
  GenerationResult,
  GenerationRunOptions,
  GenerationSeed,
  GenerationService,
  GenerationValidationResult,
  GeneratorConfig,
  InstalledSystemPack,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { UnknownGeneratorError, normalizeSeed, runGenerator, validateGenerationResult } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Generation pack: deterministic seeded procedural generation (capability
 * program Phase 7), publishing `world.generation`. Reads `content/generation.json`
 * and turns a bounded, content-authored generator config plus a normalized seed
 * into a `NormalizedLevel` - the exact structure the Tiled pipeline produces -
 * so generated worlds flow through the identical downstream path.
 *
 * Project-owned deterministic PRNG, no new dependency. Renderer-neutral: the
 * pack core touches no Phaser object; the scene shell materializes the
 * generated `NormalizedLevel` through the existing world/entity machinery.
 */

class GenerationServiceImpl implements GenerationService {
  readonly #defs = new Map<string, { id: string } & GeneratorConfig>();
  readonly #baseSeed: number;

  constructor(doc: GenerationDoc | undefined) {
    this.#baseSeed = normalizeSeed(doc?.seed ?? 0);
    for (const g of doc?.generators ?? []) {
      if (this.#defs.has(g.id)) throw new Error(`Duplicate generator id "${g.id}" in content/generation.json.`);
      this.#defs.set(g.id, g);
    }
  }

  availableGenerators(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  normalizeSeed(input: unknown): GenerationSeed {
    return normalizeSeed(input);
  }

  generate(generatorId: string, options?: GenerationRunOptions): GenerationResult {
    const def = this.#defs.get(generatorId);
    if (!def) throw new UnknownGeneratorError(generatorId);
    const seed = options?.seed !== undefined ? normalizeSeed(options.seed) : this.#seedFor(generatorId);
    const overrides: { size?: number; difficulty?: number } = {};
    if (options?.size !== undefined) overrides.size = options.size;
    if (options?.difficulty !== undefined) overrides.difficulty = options.difficulty;
    return runGenerator(def, seed, 'main', overrides);
  }

  validate(result: GenerationResult): GenerationValidationResult {
    return validateGenerationResult(result);
  }

  /** A stable per-generator sub-seed so two generators in one document differ. */
  #seedFor(generatorId: string): number {
    let h = this.#baseSeed >>> 0;
    for (let i = 0; i < generatorId.length; i++) {
      h ^= generatorId.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
}

export const generationPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.generation,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.generation],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const doc = context.content.data['generation']?.value as GenerationDoc | undefined;
    const service = new GenerationServiceImpl(doc);
    const handle = context.capabilities.provide(CAPABILITY_IDS.generation, service);
    return {
      id: PACK_IDS.generation,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { GenerationService } from '@sw2d/contracts';
