/**
 * Strategy orders & tactical actions authoring surface (capability program Phase 14).
 *
 * A structured read-only view of `content/strategy-actions.json` — the tactical
 * action catalog `strategy.tactics` consumes (targeting mode, range and minimum
 * range, action-point cost, cooldown in simulation ticks, uses per turn, team
 * requirement, target filter, and the order kind each action raises).
 *
 * Read-only on purpose. The order *lifecycle* half of the capability
 * (`strategy.orders`) is not content-authored — it has no document to edit — and
 * every field here is validated against `urn:sw2d:schema:content-strategy-actions:v1`
 * before it is reported, so a malformed catalog surfaces as a located error
 * rather than a plausible-looking panel.
 *
 * Calls `POST /api/tactics/inspect`.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { StrategyActionsDocument } from '@sw2d/contracts';
import { validateStrategyActionsDocument } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { SecurityError } from './security.ts';

export interface StrategyActionRow {
  readonly id: string;
  readonly displayName: string;
  readonly orderKind: string;
  readonly targeting: string;
  readonly range: number;
  readonly minRange: number | null;
  readonly cost: number;
  readonly cooldownTicks: number;
  readonly usesPerTurn: number | null;
  readonly requiresTeam: string | null;
  readonly targetFilter: string;
}

export interface StrategyActionsInspectResult {
  readonly actionPointsPerTurn: number;
  readonly actions: readonly StrategyActionRow[];
}

export function inspectStrategyActions(gameId: string): StrategyActionsInspectResult {
  const full = resolveContained(gameRoot(gameId), 'content', 'strategy-actions.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/strategy-actions.json in "${gameId}".`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/strategy-actions.json in "${gameId}" is not valid JSON.`);
  }

  const validated = validateContentBundleData({ 'strategy-actions': raw })['strategy-actions']!
    .value as StrategyActionsDocument;
  // Second gate: the semantic rules the JSON schema cannot express (unique ids,
  // minRange <= range, a targetless action with no range).
  validateStrategyActionsDocument(validated);

  return {
    actionPointsPerTurn: validated.actionPointsPerTurn ?? 0,
    actions: validated.actions.map((action) => ({
      id: action.id,
      displayName: action.displayName ?? action.id,
      orderKind: action.orderKind ?? 'ability',
      targeting: action.targeting,
      range: action.range,
      minRange: action.minRange ?? null,
      cost: action.cost ?? 0,
      cooldownTicks: action.cooldownTicks ?? 0,
      usesPerTurn: action.usesPerTurn ?? null,
      requiresTeam: action.requiresTeam ?? null,
      targetFilter: action.targetFilter ?? 'any',
    })),
  };
}
