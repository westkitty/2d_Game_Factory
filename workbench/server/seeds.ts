/**
 * Game Seeds: turning "here is an image" into candidate playable directions.
 *
 * Deterministic heuristics over the real preset catalogue plus the real
 * starter-kit registry - no model, no network, no invention. The honesty
 * rules are the point:
 *
 *  - a seed reports the preset's own `maturity` and `knownLimitations`
 *    verbatim, so a recipe preset can never look like a proven one (F15);
 *  - a seed says which roles the project actually covers and which will fall
 *    back to generated art, rather than implying full coverage;
 *  - if only one or two presets genuinely fit, one or two seeds are returned.
 */

import { getPreset, listPresets } from '@sw2d/presets';
import type { PresetDefinition } from '@sw2d/contracts';
import type { AssetsDocument, GameSeed, RoleAssignment, SingleImageMode, WorkbenchAssetRole } from '../shared/types.ts';
import { starterKitFor, starterKitDepthFor } from './starterKits/index.ts';
import { derivePalette } from './projectStore.ts';

const ROLE_WEIGHT: Readonly<Record<string, number>> = {
  player: 4,
  background: 2,
  enemy: 2,
  platform: 1.5,
  pickup: 1.5,
  hazard: 1,
  checkpoint: 0.5,
  exit: 0.5,
  tile: 0.5,
};

const MATURITY_SCORE: Readonly<Record<string, number>> = {
  'proof-validated': 100,
  'smoke-validated': 55,
  recipe: 20,
  experimental: 5,
};

export interface SeedInput {
  readonly assets: AssetsDocument;
  readonly mode?: SingleImageMode;
  readonly limit?: number;
}

function coveredRoles(assets: AssetsDocument): readonly WorkbenchAssetRole[] {
  const roles = new Set<WorkbenchAssetRole>();
  for (const asset of assets.assets) for (const role of asset.roleAssignments) roles.add(role);
  return [...roles];
}

export function assetCoverageScore(preset: PresetDefinition, covered: readonly WorkbenchAssetRole[]): number {
  const kit = starterKitFor(preset.id);
  const wanted = kit?.usefulRoles ?? ['player'];
  let total = 0;
  let have = 0;
  for (const role of wanted) {
    const weight = ROLE_WEIGHT[role] ?? 1;
    total += weight;
    if (covered.includes(role as WorkbenchAssetRole)) have += weight;
  }
  return total === 0 ? 0 : have / total;
}

function modeBonus(preset: PresetDefinition, mode: SingleImageMode | undefined, covered: readonly WorkbenchAssetRole[]): number {
  if (mode === undefined || mode === 'unsure' || mode === 'reference') return 0;
  if (mode === 'direct' && covered.includes('player')) {
    return preset.controllerFamilies.includes('platform') || preset.controllerFamilies.includes('top-down') ? 12 : 0;
  }
  if (covered.includes('background') && !preset.controllerFamilies.includes('ui-simulation')) return 8;
  return 0;
}

export function rankPresets(assets: AssetsDocument, mode?: SingleImageMode): readonly { preset: PresetDefinition; score: number; coverage: number }[] {
  const covered = coveredRoles(assets);
  return listPresets()
    .map((preset) => {
      const coverage = assetCoverageScore(preset, covered);
      const maturity = MATURITY_SCORE[preset.maturity] ?? 0;
      const score = maturity + coverage * 30 + modeBonus(preset, mode, covered);
      return { preset, score, coverage };
    })
    .sort((a, b) => b.score - a.score || a.preset.id.localeCompare(b.preset.id));
}

function rolePlanFor(preset: PresetDefinition, assets: AssetsDocument): readonly RoleAssignment[] {
  const kit = starterKitFor(preset.id);
  const roles = (kit?.usefulRoles ?? ['player', 'platform', 'pickup', 'hazard', 'checkpoint', 'exit']) as readonly WorkbenchAssetRole[];
  return roles.map((role) => {
    const asset = assets.assets.find((candidate) => candidate.roleAssignments.includes(role));
    if (asset) return { role, assetId: asset.id, coverage: 'assigned' as const };
    return { role, assetId: null, coverage: 'auto' as const };
  });
}

/**
 * A seed must have something meaningfully playable behind the button. A
 * registered starter kit qualifies regardless of the preset's evidence
 * maturity; otherwise only smoke-validated presets qualify. This lets a
 * recipe preset gain a rich starter without falsely becoming proof-validated.
 */
export function buildSeeds(input: SeedInput): readonly GameSeed[] {
  const limit = input.limit ?? 3;
  const palette = derivePalette(input.assets);
  const ranked = rankPresets(input.assets, input.mode).filter(
    (entry) => starterKitFor(entry.preset.id) !== undefined || entry.preset.maturity === 'smoke-validated',
  );

  const seeds: GameSeed[] = [];
  const familiesSeen = new Set<string>();

  for (const entry of ranked) {
    if (seeds.length >= limit) break;
    if (familiesSeen.has(entry.preset.family)) continue;
    familiesSeen.add(entry.preset.family);
    seeds.push(toSeed(entry.preset, entry.coverage, input.assets, palette));
  }
  for (const entry of ranked) {
    if (seeds.length >= limit) break;
    if (seeds.some((seed) => seed.presetId === entry.preset.id)) continue;
    seeds.push(toSeed(entry.preset, entry.coverage, input.assets, palette));
  }
  return seeds;
}

function toSeed(preset: PresetDefinition, coverage: number, assets: AssetsDocument, palette: readonly string[]): GameSeed {
  const kit = starterKitFor(preset.id);
  const rolePlan = rolePlanFor(preset, assets);
  return {
    id: `seed-${preset.id}`,
    presetId: preset.id,
    presetDisplayName: preset.displayName,
    maturity: preset.maturity,
    starterKitDepth: starterKitDepthFor(preset.id, preset.maturity),
    loop: kit?.loop ?? `A ${preset.displayName.toLowerCase()} built from this preset's generated shell - a working composition to build on, not a finished game.`,
    rolePlan,
    usesAssetIds: rolePlan.filter((entry) => entry.assetId !== null).map((entry) => entry.assetId!),
    generatedFallbackRoles: rolePlan.filter((entry) => entry.assetId === null).map((entry) => entry.role),
    palette,
    knownLimitations: preset.knownLimitations,
    assetCoverageScore: Math.round(coverage * 100) / 100,
  };
}

export function seedForPreset(presetId: string, assets: AssetsDocument): GameSeed {
  const preset = getPreset(presetId);
  const coverage = assetCoverageScore(preset, coveredRoles(assets));
  return toSeed(preset, coverage, assets, derivePalette(assets));
}
