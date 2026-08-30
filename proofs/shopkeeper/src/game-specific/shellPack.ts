import {
  ECONOMY_CAPABILITY_ID,
  PRODUCTION_CAPABILITY_ID,
  WALL_CLOCK_CAPABILITY_ID,
  ManualWallClock,
  type CustomerState,
  type EconomyService,
  type GoodState,
  type InstalledSystemPack,
  type OfflineReport,
  type PlacementResult,
  type PrestigeState,
  type ProductionJob,
  type ProductionService,
  type ProductionStartResult,
  type QueueState,
  type StationState,
  type TransactionResult,
} from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 19 proof - shopkeeper.
 *
 * The shop is the capability. This shell draws a counter, wires two keys, and
 * reports what it observes; it holds no stock, no price, no queue and no till.
 * Every number the proof asserts is read back out of `simulation.economy` or
 * `simulation.production`.
 *
 * The shell cannot advance the simulation: neither service exposes `update()`,
 * and the pack owns the frame. What the shell does instead is `drainEvents()`,
 * which is how it knows a customer reached the till without polling for it.
 *
 * `src/main.ts` injects a `ManualWallClock` through `createGame({ wallClock })`
 * so the proof can be away for eight hours without waiting eight hours. That is
 * a test control, and it is the same injected interface the browser clock
 * implements - not a back door into the economy.
 */

export const SHOP_SHELL_CAPABILITY_ID = 'game.shop-shell';

export interface ShopShellState {
  readonly goods: readonly GoodState[];
  readonly funds: number;
  readonly stations: readonly StationState[];
  readonly jobs: readonly ProductionJob[];
  readonly queues: readonly QueueState[];
  readonly customers: readonly CustomerState[];
  readonly prestige: PrestigeState;
  /** Every phase transition the economy announced, as `customerId:phase`. */
  readonly phaseLog: readonly string[];
  /** Every departure, as `customerId:outcome`. */
  readonly departures: readonly string[];
  readonly transactions: readonly {
    readonly itemId: string;
    readonly side: string;
    readonly quantity: number;
    readonly total: number;
    readonly ok: boolean;
  }[];
  readonly completedJobs: readonly string[];
  readonly unlocked: Readonly<Record<string, boolean>>;
  readonly lastOffline: OfflineReport | null;
  readonly wallClockMs: number;
}

export interface ShopShellService {
  state(): ShopShellState;
  spawn(archetypeId: string, id: string): CustomerState | null;
  sell(itemId: string, quantity: number, buyerFunds: number): TransactionResult;
  restock(itemId: string, quantity?: number): TransactionResult;
  setDemand(itemId: string, multiplier: number): void;
  startJob(recipeId: string, stationId?: string): ProductionStartResult;
  cancelJob(jobId: string): boolean;
  canPlace(stationId: string, x: number, y: number): PlacementResult;
  place(stationId: string, x: number, y: number): PlacementResult;
  /** Save now, then claim to have been away for `ms`, then resume. */
  goOffline(ms: number): OfflineReport;
  prestige(): ReturnType<EconomyService['performPrestige']>;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: SHOP_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [SHOP_SHELL_CAPABILITY_ID],
  dependencies: [ECONOMY_CAPABILITY_ID, PRODUCTION_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const economy = context.capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    const production = context.capabilities.require<ProductionService>(PRODUCTION_CAPABILITY_ID);

    /**
     * The clock the economy is actually using. `src/main.ts` injects a
     * `ManualWallClock` through `createGame({ wallClock })`, so moving it here
     * moves the same clock `save()` stamps and `resume()` reads. Reaching into
     * a private field to fake an absence would prove nothing.
     */
    const clock = context.capabilities.require<ManualWallClock>(WALL_CLOCK_CAPABILITY_ID);

    const counter = scene.add.sprite(width * 0.5, height * 0.55, context.assets.resolve('player'));
    const label = scene.add.text(width * 0.5, height * 0.2, '', { fontSize: '18px' }).setOrigin(0.5);

    const phaseLog: string[] = [];
    const departures: string[] = [];
    const completedJobs: string[] = [];
    const transactions: ShopShellState['transactions'] = [];
    let lastOffline: OfflineReport | null = null;

    /**
     * Drain what the capability announced this frame. The shell learns about a
     * customer reaching the till this way rather than by polling, which is also
     * why it can report the exact phase order the proof asserts.
     */
    function pump(): void {
      for (const event of economy.drainEvents()) {
        switch (event.kind) {
          case 'customer-phase':
            phaseLog.push(`${event.customerId}:${event.phase}`);
            break;
          case 'customer-left':
            departures.push(`${event.customerId}:${event.outcome}`);
            break;
          case 'transaction':
            (transactions as ShopShellState['transactions'][number][]).push({
              itemId: event.result.itemId,
              side: event.result.side,
              quantity: event.result.quantity,
              total: event.result.total,
              ok: event.result.ok,
            });
            break;
          default:
            break;
        }
      }
      for (const event of production.drainEvents()) {
        if (event.kind === 'job-completed') completedJobs.push(event.recipeId);
      }
    }

    function state(): ShopShellState {
      pump();
      return {
        goods: economy.goods(),
        funds: economy.funds(),
        stations: production.stations(),
        jobs: production.jobs(),
        queues: economy.queues(),
        customers: economy.customers(),
        prestige: economy.prestigeState(),
        phaseLog: [...phaseLog],
        departures: [...departures],
        transactions: [...transactions],
        completedJobs: [...completedJobs],
        unlocked: Object.fromEntries(
          production.recipes().map((recipe) => [recipe.id, production.isUnlocked(recipe.id)]),
        ),
        lastOffline,
        wallClockMs: clock.now(),
      };
    }

    const shellService: ShopShellService = {
      state,
      spawn: (archetypeId, id) => economy.spawnCustomer(archetypeId, { id }),
      sell: (itemId, quantity, buyerFunds) => economy.transact({ itemId, quantity, side: 'sell', buyerFunds }),
      restock: (itemId, quantity) => economy.restock(itemId, quantity),
      setDemand: (itemId, multiplier) => economy.setDemandMultiplier(itemId, multiplier),
      startJob: (recipeId, stationId) => production.start(recipeId, stationId),
      cancelJob: (jobId) => production.cancel(jobId),
      canPlace: (stationId, x, y) => production.canPlace(stationId, x, y),
      place: (stationId, x, y) => production.place(stationId, x, y),
      goOffline(ms) {
        // Save stamps the clock; moving it and resuming is exactly what a player
        // closing the tab and coming back does, minus the waiting.
        economy.save();
        clock.advance(ms);
        lastOffline = economy.resume();
        return lastOffline;
      },
      prestige: () => economy.performPrestige(),
      reset() {
        economy.reset();
        phaseLog.length = 0;
        departures.length = 0;
        completedJobs.length = 0;
        (transactions as unknown[]).length = 0;
        lastOffline = null;
        economy.drainEvents();
        production.drainEvents();
      },
    };

    const serviceHandle = context.capabilities.provide(SHOP_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(SHOP_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: SHOP_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        pump();
        // Presentation only: the counter brightens while someone is being served.
        const busy = economy.queues().some((queue) => queue.serving.length > 0);
        counter.setAlpha(busy ? 1 : 0.6);
        const apples = economy.good('apple');
        label.setText(`Coin ${economy.funds()} | Apples ${apples?.stock ?? 0} | Queue ${economy.customers().length}`);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          counter.destroy();
          label.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
