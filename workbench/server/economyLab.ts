/**
 * Economy authoring surface (Category-C Wave 1 / ADR-0028).
 *
 * The smallest useful surface: surface the game's `content/economy.json`
 * (mode, cash, goods, recipes, demand, spawn). Read-only - editing is JSON
 * work on the file. Live queue/cash belong on the in-game debug snapshot.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EconomyCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface EconomyInspectResult {
  readonly present: boolean;
  readonly mode: string;
  readonly cash: number;
  readonly autoSell: boolean;
  readonly goods: readonly { readonly id: string; readonly displayName: string; readonly price: number; readonly restockCost: number; readonly stock: number }[];
  readonly recipes: readonly { readonly id: string; readonly displayName: string; readonly outputGoodId: string; readonly outputCount: number; readonly durationMs: number }[];
  readonly demand: readonly { readonly id: string; readonly displayName: string; readonly goodId: string; readonly patienceMs: number }[];
  readonly spawn: { readonly firstDelayMs: number; readonly intervalMs: number; readonly maxQueue: number };
}

export function inspectEconomy(gameId: string): EconomyInspectResult {
  const full = path.join(gameRoot(gameId), 'content', 'economy.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/economy.json in "${gameId}".`);
  const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
  const catalog = validateContentBundleData({ economy: raw }).economy!.value as EconomyCatalog;
  return {
    present: catalog.goods.length > 0 || catalog.demand.length > 0,
    mode: catalog.mode,
    cash: catalog.cash,
    autoSell: catalog.autoSell === true,
    goods: catalog.goods.map((g) => ({
      id: g.id,
      displayName: g.displayName,
      price: g.price,
      restockCost: g.restockCost ?? 0,
      stock: g.stock,
    })),
    recipes: (catalog.recipes ?? []).map((r) => ({
      id: r.id,
      displayName: r.displayName,
      outputGoodId: r.outputGoodId,
      outputCount: r.outputCount,
      durationMs: r.durationMs,
    })),
    demand: catalog.demand.map((d) => ({
      id: d.id,
      displayName: d.displayName,
      goodId: d.goodId,
      patienceMs: d.patienceMs,
    })),
    spawn: catalog.spawn,
  };
}
