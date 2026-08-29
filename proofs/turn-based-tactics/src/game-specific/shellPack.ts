import {
  NAV_CAPABILITY_ID,
  STRATEGY_ORDERS_CAPABILITY_ID,
  STRATEGY_TACTICS_CAPABILITY_ID,
  createRouteFollower,
  type InstalledSystemPack,
  type NavGrid,
  type NavService,
  type NavPath,
  type OrderActorSnapshot,
  type OrderExecutionOutcome,
  type OrderTarget,
  type OrderWorldAdapter,
  type RouteFollower,
  type StrategyOrder,
  type StrategyOrdersService,
  type StrategyTacticsService,
  type TacticalExecutionResult,
  type TacticalValidity,
} from '@sw2d/contracts';
import type { CombatService, StrategyService } from '@sw2d/packs';
import { CAPABILITY_IDS } from '@sw2d/packs';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 5 proof - turn-based-tactics. A selectable unit gets a deterministic
 * reachable-cell set from `sw2d.navigation` (`NavGrid.reachable`), and when
 * the player confirms a cursor cell inside that set the unit follows the
 * grid's returned route (`RouteFollower` / `advanceAlongPath`). No hand-rolled
 * BFS, no hand-rolled route stepping.
 *
 * Phase 14 addition - the same shell now proves that `sw2d.strategy-actions`
 * is not RTS-only. Range, minimum range, action-point cost, per-turn uses,
 * cooldown, target legality and the completed/failed order verdict all come
 * from `strategy.tactics` + `strategy.orders`; this shell supplies only the
 * `OrderWorldAdapter` - where a unit is, and what one tick of a move or an
 * attack does. Movement inside that adapter reuses the Phase 5 `RouteFollower`
 * rather than a second, order-specific path stepper.
 */

const COLS = 10;
const ROWS = 8;
const CELL = 60;
const MOVE_BUDGET = 4;
const UNIT_SPEED = 240; // px/s
// A few walls so the reachable set and the route are non-trivial.
const WALLS: ReadonlyArray<readonly [number, number]> = [
  [4, 2],
  [4, 3],
  [4, 4],
  [4, 5],
];

const HERO = 'hero';
const FOE_NEAR = 'foe-near';
const FOE_FAR = 'foe-far';
const HERO_TEAM = 'blue';
const FOE_TEAM = 'red';
const STRIKE_DAMAGE = 30;

/** Starting cells. `foe-near` is one cell east of the hero; `foe-far` is six. */
const START_CELLS: Readonly<Record<string, readonly [number, number]>> = {
  [HERO]: [2, 4],
  [FOE_NEAR]: [3, 4],
  [FOE_FAR]: [8, 4],
};

export const GRID_SHELL_CAPABILITY_ID = 'game.grid-shell';

export interface TacticsShellState {
  readonly turnNumber: number;
  readonly activeTeam: string | null;
  readonly points: number;
  readonly available: readonly string[];
  readonly heroHp: number;
  readonly foeNearHp: number;
  readonly foeFarHp: number;
  readonly strikeCooldown: number;
  readonly snipeCooldown: number;
  readonly braceUsesRemaining: number;
  readonly lastOrderId: string | null;
  readonly lastOrderStatus: string | null;
  readonly lastOrderFailure: string | null;
}

export interface GridShellService {
  tactics(): TacticsShellState;
  validate(actionId: string, target: OrderTarget): TacticalValidity;
  execute(actionId: string, target: OrderTarget): TacticalExecutionResult;
  /** Ends the team's turn: rotates `strategy.turns` and refreshes tactical resources. */
  endTurn(): { turnNumber: number; activeTeam: string | null };
  /** Reduce an actor to 0 hp through the combat service, so target-loss is real. */
  slay(actorId: string): void;
  order(orderId: string): StrategyOrder | undefined;
  cellCentre(col: number, row: number): { x: number; y: number };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [GRID_SHELL_CAPABILITY_ID],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const nav = context.capabilities.require<NavService>(NAV_CAPABILITY_ID);
    const grid: NavGrid = nav.defineGrid('battlefield', { cols: COLS, rows: ROWS, cellSize: CELL, blocked: WALLS });
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const strategy = context.capabilities.require<StrategyService>(CAPABILITY_IDS.strategy);
    const orders = context.capabilities.require<StrategyOrdersService>(STRATEGY_ORDERS_CAPABILITY_ID);
    const tactics = context.capabilities.require<StrategyTacticsService>(STRATEGY_TACTICS_CAPABILITY_ID);

    for (const [c, r] of WALLS) {
      const [x, y] = grid.cellToWorld(c, r);
      scene.add.rectangle(x, y, CELL - 6, CELL - 6, 0x39415a);
    }

    let unit = { col: 2, row: 4 };
    let cursor = { col: 2, row: 4 };
    const unitPos = { ...pos(unit) };
    const unitSprite = scene.add.sprite(unitPos.x, unitPos.y, context.assets.resolve('player'));
    const cursorSprite = scene.add.sprite(unitPos.x, unitPos.y, context.assets.resolve('checkpoint')).setAlpha(0.6);

    function pos(c: { col: number; row: number }): { x: number; y: number } {
      const [x, y] = grid.cellToWorld(c.col, c.row);
      return { x, y };
    }

    let reachable = grid.reachable(unit, MOVE_BUDGET);
    const follower = createRouteFollower();
    let moving = false;
    let lastPath: NavPath | null = null;
    let arrivedAt: { col: number; row: number } | null = null;
    let confirmsRejected = 0;

    function recomputeReachable(): void {
      reachable = grid.reachable(unit, MOVE_BUDGET);
    }

    function inReachable(c: { col: number; row: number }): boolean {
      return reachable.some((rc) => rc.col === c.col && rc.row === c.row);
    }

    // --- Phase 14: tactical actors, teams and the order world adapter -----

    strategy.registerTeam(HERO_TEAM);
    strategy.registerTeam(FOE_TEAM);
    strategy.advanceTurn(); // blue moves first

    const actorPos = new Map<string, { x: number; y: number }>();
    for (const [actorId, [col, row]] of Object.entries(START_CELLS)) {
      const [x, y] = grid.cellToWorld(col, row);
      actorPos.set(actorId, { x, y });
    }
    combat.register(HERO, 100);
    combat.register(FOE_NEAR, 100);
    combat.register(FOE_FAR, 100);

    const foeSprites = [FOE_NEAR, FOE_FAR].map((id) => {
      const at = actorPos.get(id)!;
      return { id, sprite: scene.add.sprite(at.x, at.y, context.assets.resolve('enemy')) };
    });

    const teamOf: Readonly<Record<string, string>> = {
      [HERO]: HERO_TEAM,
      [FOE_NEAR]: FOE_TEAM,
      [FOE_FAR]: FOE_TEAM,
    };

    /** One follower per ordered actor. Only the hero is ordered in this proof. */
    const orderFollowers = new Map<string, RouteFollower>();
    let lastOrder: StrategyOrder | null = null;

    const adapter: OrderWorldAdapter = {
      actor(actorId: string): OrderActorSnapshot | undefined {
        const at = actorPos.get(actorId);
        if (!at) return undefined;
        const teamId = teamOf[actorId];
        return {
          actorId,
          x: at.x,
          y: at.y,
          alive: combat.get(actorId).current > 0,
          ...(teamId !== undefined ? { teamId } : {}),
        };
      },

      begin(order: StrategyOrder): OrderExecutionOutcome {
        if (order.kind !== 'move' || order.target.kind !== 'position') return { progress: 'running' };
        const at = actorPos.get(order.actorId)!;
        const cell = grid.worldToCell(order.target.x, order.target.y);
        const routed = createRouteFollower();
        // The Phase 5 route follower is the mover here too - an order does not
        // get its own pathfinding.
        if (!routed.setDestination(grid, at.x, at.y, cell.col, cell.row)) {
          return { progress: 'failed', reason: 'unreachable' };
        }
        orderFollowers.set(order.actorId, routed);
        return { progress: 'running' };
      },

      advance(order: StrategyOrder, deltaMs: number): OrderExecutionOutcome {
        if (order.kind === 'move' && order.target.kind === 'position') {
          const routed = orderFollowers.get(order.actorId);
          const at = actorPos.get(order.actorId);
          if (!routed || !at) return { progress: 'failed', reason: 'unreachable' };
          const stepped = routed.step(at.x, at.y, (UNIT_SPEED * deltaMs) / 1000);
          at.x = stepped.x;
          at.y = stepped.y;
          if (order.actorId === HERO) {
            unitPos.x = stepped.x;
            unitPos.y = stepped.y;
            unitSprite.setPosition(stepped.x, stepped.y);
          }
          if (!stepped.arrived) return { progress: 'running' };
          const cell = grid.worldToCell(at.x, at.y);
          if (order.actorId === HERO) {
            unit = { col: cell.col, row: cell.row };
            recomputeReachable();
          }
          return { progress: 'complete' };
        }

        if (order.kind === 'attack' && order.target.kind === 'entity') {
          const health = combat.damage(order.target.entityId, STRIKE_DAMAGE, 0);
          if (health.current <= 0) {
            const dead = foeSprites.find((f) => f.id === (order.target as { entityId: string }).entityId);
            dead?.sprite.setAlpha(0.25);
          }
          return { progress: 'complete' };
        }

        // 'brace' and other targetless abilities resolve in one tick.
        return { progress: 'complete' };
      },

      end(order: StrategyOrder): void {
        orderFollowers.delete(order.actorId);
      },
    };

    const adapterHandle = orders.setWorldAdapter(adapter);
    const orderWatch = context.events.on('orders:resolved', ({ orderId }) => {
      const resolved = orders.order(orderId);
      if (resolved && resolved.actorId === HERO) lastOrder = resolved;
    });

    function tacticsState(): TacticsShellState {
      return {
        turnNumber: strategy.turnNumber(),
        activeTeam: strategy.activeTeam(),
        points: tactics.points(HERO),
        available: tactics.available(HERO),
        heroHp: combat.get(HERO).current,
        foeNearHp: combat.get(FOE_NEAR).current,
        foeFarHp: combat.get(FOE_FAR).current,
        strikeCooldown: tactics.cooldown('strike', HERO),
        snipeCooldown: tactics.cooldown('snipe', HERO),
        braceUsesRemaining: tactics.usesRemaining('brace', HERO),
        lastOrderId: lastOrder?.orderId ?? null,
        lastOrderStatus: lastOrder?.status ?? null,
        lastOrderFailure: lastOrder?.failureReason ?? null,
      };
    }

    const shellService: GridShellService = {
      tactics: tacticsState,
      validate: (actionId, target) => tactics.validate(actionId, HERO, target),
      execute: (actionId, target) => tactics.execute(actionId, HERO, target),
      endTurn() {
        const team = strategy.advanceTurn();
        tactics.refresh();
        return { turnNumber: strategy.turnNumber(), activeTeam: team };
      },
      slay(actorId: string): void {
        const health = combat.get(actorId);
        combat.damage(actorId, health.current, 0);
      },
      order: (orderId) => orders.order(orderId),
      cellCentre(col, row) {
        const [x, y] = grid.cellToWorld(col, row);
        return { x, y };
      },
    };

    const serviceHandle = context.capabilities.provide(GRID_SHELL_CAPABILITY_ID, shellService);

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      unitCol: unit.col,
      unitRow: unit.row,
      cursorCol: cursor.col,
      cursorRow: cursor.row,
      reachableCount: reachable.length,
      cursorReachable: inReachable(cursor),
      moving,
      lastPathLen: lastPath?.cells.length ?? 0,
      lastPathCost: lastPath ? Math.round(lastPath.cost * 100) / 100 : 0,
      arrivedAt,
      confirmsRejected,
      ...tacticsState(),
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = gridController.read(context.input);

        if (!moving && intent.step) {
          if (intent.step === 'up') cursor = { ...cursor, row: Math.max(0, cursor.row - 1) };
          if (intent.step === 'down') cursor = { ...cursor, row: Math.min(ROWS - 1, cursor.row + 1) };
          if (intent.step === 'left') cursor = { ...cursor, col: Math.max(0, cursor.col - 1) };
          if (intent.step === 'right') cursor = { ...cursor, col: Math.min(COLS - 1, cursor.col + 1) };
          const cp = pos(cursor);
          cursorSprite.setPosition(cp.x, cp.y);
        }

        if (!moving && intent.confirmPressed) {
          if (!inReachable(cursor) || (cursor.col === unit.col && cursor.row === unit.row)) {
            confirmsRejected += 1;
          } else if (follower.setDestination(grid, unitPos.x, unitPos.y, cursor.col, cursor.row)) {
            lastPath = follower.path;
            moving = true;
          } else {
            confirmsRejected += 1;
          }
        }

        if (moving) {
          const stepDist = (UNIT_SPEED * deltaMs) / 1000;
          const r = follower.step(unitPos.x, unitPos.y, stepDist);
          unitPos.x = r.x;
          unitPos.y = r.y;
          unitSprite.setPosition(r.x, r.y);
          const heroAt = actorPos.get(HERO);
          if (heroAt) {
            heroAt.x = r.x;
            heroAt.y = r.y;
          }
          if (r.arrived) {
            moving = false;
            unit = { ...cursor };
            arrivedAt = { ...unit };
            recomputeReachable();
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        orderWatch.dispose();
        debugHandle.dispose();
        serviceHandle.dispose();
        adapterHandle.dispose();
        for (const id of [HERO, FOE_NEAR, FOE_FAR]) combat.remove(id);
        nav.remove('battlefield');
        try {
          unitSprite.destroy();
          cursorSprite.destroy();
          for (const foe of foeSprites) foe.sprite.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
