import {
  NAV_CAPABILITY_ID,
  STRATEGY_ORDERS_CAPABILITY_ID,
  STRATEGY_TACTICS_CAPABILITY_ID,
  createRouteFollower,
  type InstalledSystemPack,
  type NavGrid,
  type NavService,
  type OrderActorSnapshot,
  type OrderExecutionOutcome,
  type OrderGroup,
  type OrderIssueResult,
  type OrderQueueMode,
  type OrderWorldAdapter,
  type RouteFollower,
  type StrategyOrder,
  type StrategyOrdersService,
  type StrategyTacticsService,
  type TacticalExecutionResult,
  type TacticalValidity,
} from '@sw2d/contracts';
import type { CombatService } from '@sw2d/packs';
import { CAPABILITY_IDS } from '@sw2d/packs';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 14 proof - simple-rts.
 *
 * Everything about *commands* comes from `sw2d.strategy-actions`: order ids,
 * queue order, replace/append policy, active-vs-queued status, cancellation,
 * dead-actor and dead-target handling, and the completed/failed verdict. This
 * shell contributes exactly two things a reusable capability cannot know:
 *
 *  1. the input surface (which units a drag rectangle selects), and
 *  2. the `OrderWorldAdapter` - where a unit is, and what one tick of "move",
 *     "attack" or "attack-move" does to the world.
 *
 * Movement inside the adapter reuses `sw2d.navigation`'s `RouteFollower`
 * (Phase 5) rather than a second, order-specific path stepper, so an order to
 * the far side of the wall really is routed, and an order into the wall really
 * has no route and fails as `unreachable`.
 */

const COLS = 16;
const ROWS = 9;
const CELL = 60;
const UNIT_SPEED = 300; // px/s
const ATTACK_RANGE = 70; // world units - just over one cell
const ATTACK_DPS_PER_TICK = 5;
const UNIT_HP = 100;

/** A wall column with a gap top and bottom, so routing around it is real work. */
const WALLS: ReadonlyArray<readonly [number, number]> = [
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 5],
  [7, 6],
];

const BLUE = 'blue';
const RED = 'red';

interface UnitSpec {
  readonly id: string;
  readonly team: string;
  readonly cell: readonly [number, number];
}

const UNITS: readonly UnitSpec[] = [
  { id: 'blue-1', team: BLUE, cell: [1, 4] },
  { id: 'blue-2', team: BLUE, cell: [1, 6] },
  { id: 'blue-3', team: BLUE, cell: [2, 2] },
  { id: 'red-1', team: RED, cell: [12, 4] },
  { id: 'red-2', team: RED, cell: [13, 6] },
];

export const RTS_SHELL_CAPABILITY_ID = 'game.rts-shell';

export interface RtsUnitState {
  readonly x: number;
  readonly y: number;
  readonly col: number;
  readonly row: number;
  readonly hp: number;
  readonly alive: boolean;
  readonly team: string;
}

export interface RtsOrderSummary {
  readonly orderId: string;
  readonly kind: string;
  readonly status: string;
}

export interface RtsShellState {
  readonly tick: number;
  readonly selection: readonly string[];
  readonly units: Readonly<Record<string, RtsUnitState>>;
  readonly active: Readonly<Record<string, RtsOrderSummary | null>>;
  readonly queueLengths: Readonly<Record<string, number>>;
  readonly pendingCount: number;
  readonly historyCount: number;
  readonly lastResolved: { readonly orderId: string; readonly actorId: string; readonly status: string; readonly reason: string | null } | null;
}

export interface RtsShellService {
  state(): RtsShellState;
  /** Selects every living blue unit whose position falls inside the world rectangle. */
  selectBox(x: number, y: number, width: number, height: number): readonly string[];
  select(actorIds: readonly string[]): readonly string[];
  clearSelection(): void;

  orderMove(col: number, row: number, queueMode?: OrderQueueMode): OrderIssueResult;
  orderAttack(targetId: string, queueMode?: OrderQueueMode): OrderIssueResult;
  orderAttackMove(col: number, row: number, queueMode?: OrderQueueMode): OrderIssueResult;
  orderHold(queueMode?: OrderQueueMode): OrderIssueResult;
  orderStop(): number;
  cancel(orderId: string): boolean;

  order(orderId: string): StrategyOrder | undefined;
  activeOf(actorId: string): StrategyOrder | undefined;
  queueOf(actorId: string): readonly StrategyOrder[];

  defineSquad(groupId: string, actorIds: readonly string[]): OrderGroup;
  orderSquadHold(groupId: string): OrderIssueResult;

  /** Tactical-action half of the same pack, driven from the same catalog document. */
  validateAction(actionId: string, actorId: string, targetId: string): TacticalValidity;
  executeAction(actionId: string, actorId: string, targetId: string): TacticalExecutionResult;

  /** Reduce a unit to 0 hp through the combat service, so actor/target loss is real. */
  slay(actorId: string): void;
  cellOf(actorId: string): { col: number; row: number };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.rts-shell',
  version: '0.1.0',
  provides: [RTS_SHELL_CAPABILITY_ID],
  dependencies: [CAPABILITY_IDS.combat, CAPABILITY_IDS.navigation, STRATEGY_ORDERS_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const nav = context.capabilities.require<NavService>(NAV_CAPABILITY_ID);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const orders = context.capabilities.require<StrategyOrdersService>(STRATEGY_ORDERS_CAPABILITY_ID);
    const tactics = context.capabilities.require<StrategyTacticsService>(STRATEGY_TACTICS_CAPABILITY_ID);

    const grid: NavGrid = nav.defineGrid('battlefield', { cols: COLS, rows: ROWS, cellSize: CELL, blocked: WALLS });

    for (const [c, r] of WALLS) {
      const [x, y] = grid.cellToWorld(c, r);
      scene.add.rectangle(x, y, CELL - 6, CELL - 6, 0x39415a);
    }

    interface LiveUnit {
      readonly id: string;
      readonly team: string;
      x: number;
      y: number;
      readonly sprite: Phaser.GameObjects.Sprite;
    }

    const units = new Map<string, LiveUnit>();
    for (const spec of UNITS) {
      const [x, y] = grid.cellToWorld(spec.cell[0], spec.cell[1]);
      const key = context.assets.resolve(spec.team === BLUE ? 'player' : 'enemy');
      const sprite = scene.add.sprite(x, y, key);
      units.set(spec.id, { id: spec.id, team: spec.team, x, y, sprite });
      combat.register(spec.id, UNIT_HP);
    }

    const alive = (id: string): boolean => units.has(id) && combat.get(id).current > 0;

    let selection: string[] = [];
    const followers = new Map<string, RouteFollower>();
    let lastResolved: RtsShellState['lastResolved'] = null;

    function routeTo(actorId: string, x: number, y: number): OrderExecutionOutcome {
      const unit = units.get(actorId);
      if (!unit) return { progress: 'failed', reason: 'actor-removed' };
      const cell = grid.worldToCell(x, y);
      const follower = createRouteFollower();
      if (!follower.setDestination(grid, unit.x, unit.y, cell.col, cell.row)) {
        return { progress: 'failed', reason: 'unreachable' };
      }
      followers.set(actorId, follower);
      return { progress: 'running' };
    }

    /** Steps an actor along its current route. Returns true once it has arrived. */
    function stepRoute(actorId: string, deltaMs: number): boolean {
      const unit = units.get(actorId);
      const follower = followers.get(actorId);
      if (!unit || !follower) return true;
      const moved = follower.step(unit.x, unit.y, (UNIT_SPEED * deltaMs) / 1000);
      unit.x = moved.x;
      unit.y = moved.y;
      unit.sprite.setPosition(moved.x, moved.y);
      return moved.arrived;
    }

    function nearestEnemyWithin(actorId: string, range: number): string | null {
      const self = units.get(actorId);
      if (!self) return null;
      let best: { id: string; d: number } | null = null;
      for (const other of units.values()) {
        if (other.team === self.team || !alive(other.id)) continue;
        const d = Math.hypot(other.x - self.x, other.y - self.y);
        if (d <= range && (best === null || d < best.d || (d === best.d && other.id < best.id))) {
          best = { id: other.id, d };
        }
      }
      return best?.id ?? null;
    }

    const adapter: OrderWorldAdapter = {
      actor(actorId: string): OrderActorSnapshot | undefined {
        const unit = units.get(actorId);
        if (!unit) return undefined;
        return { actorId, x: unit.x, y: unit.y, alive: combat.get(actorId).current > 0, teamId: unit.team };
      },

      begin(order: StrategyOrder): OrderExecutionOutcome {
        if (order.kind === 'move' && order.target.kind === 'position') {
          return routeTo(order.actorId, order.target.x, order.target.y);
        }
        if (order.kind === 'attack-move' && order.target.kind === 'position') {
          return routeTo(order.actorId, order.target.x, order.target.y);
        }
        if (order.kind === 'attack' && order.target.kind === 'entity') {
          const target = units.get(order.target.entityId);
          if (!target) return { progress: 'failed', reason: 'target-lost' };
          const self = units.get(order.actorId)!;
          if (Math.hypot(target.x - self.x, target.y - self.y) <= ATTACK_RANGE) return { progress: 'running' };
          return routeTo(order.actorId, target.x, target.y);
        }
        return { progress: 'running' };
      },

      advance(order: StrategyOrder, deltaMs: number): OrderExecutionOutcome {
        const self = units.get(order.actorId);
        if (!self) return { progress: 'failed', reason: 'actor-removed' };

        switch (order.kind) {
          case 'move': {
            return stepRoute(order.actorId, deltaMs) ? { progress: 'complete' } : { progress: 'running' };
          }

          case 'attack-move': {
            // Fire at anything that wanders into range, but keep walking.
            const opportunistic = nearestEnemyWithin(order.actorId, ATTACK_RANGE);
            if (opportunistic) combat.damage(opportunistic, ATTACK_DPS_PER_TICK, 0);
            return stepRoute(order.actorId, deltaMs) ? { progress: 'complete' } : { progress: 'running' };
          }

          case 'attack': {
            if (order.target.kind !== 'entity') return { progress: 'failed', reason: 'invalid-target' };
            const target = units.get(order.target.entityId);
            // A target that died is the service's business (`target-lost`); a
            // target that vanished from the world entirely is ours.
            if (!target) return { progress: 'failed', reason: 'target-lost' };
            if (Math.hypot(target.x - self.x, target.y - self.y) > ATTACK_RANGE) {
              return stepRoute(order.actorId, deltaMs) ? { progress: 'failed', reason: 'out-of-range' } : { progress: 'running' };
            }
            const health = combat.damage(order.target.entityId, ATTACK_DPS_PER_TICK, 0);
            if (health.current <= 0) {
              target.sprite.setAlpha(0.25);
              return { progress: 'complete' };
            }
            return { progress: 'running' };
          }

          case 'hold':
          case 'guard':
            return { progress: 'running' };

          default:
            return { progress: 'complete' };
        }
      },

      end(order: StrategyOrder): void {
        followers.delete(order.actorId);
      },
    };

    const adapterHandle = orders.setWorldAdapter(adapter);
    const resolvedWatch = context.events.on('orders:resolved', (payload) => {
      lastResolved = {
        orderId: payload.orderId,
        actorId: payload.actorId,
        status: payload.status,
        reason: payload.reason,
      };
    });

    function unitState(id: string): RtsUnitState {
      const unit = units.get(id)!;
      const cell = grid.worldToCell(unit.x, unit.y);
      return {
        x: Math.round(unit.x * 100) / 100,
        y: Math.round(unit.y * 100) / 100,
        col: cell.col,
        row: cell.row,
        hp: combat.get(id).current,
        alive: alive(id),
        team: unit.team,
      };
    }

    function state(): RtsShellState {
      const unitStates: Record<string, RtsUnitState> = {};
      const active: Record<string, RtsOrderSummary | null> = {};
      const queueLengths: Record<string, number> = {};
      for (const id of units.keys()) {
        unitStates[id] = unitState(id);
        const current = orders.active(id);
        active[id] = current ? { orderId: current.orderId, kind: current.kind, status: current.status } : null;
        queueLengths[id] = orders.queue(id).length;
      }
      return {
        tick: orders.tick(),
        selection: [...selection],
        units: unitStates,
        active,
        queueLengths,
        pendingCount: orders.pending().length,
        historyCount: orders.history().length,
        lastResolved,
      };
    }

    function issue(
      kind: StrategyOrder['kind'],
      target: Parameters<StrategyOrdersService['issue']>[0]['target'],
      queueMode?: OrderQueueMode,
    ): OrderIssueResult {
      return orders.issue({
        kind,
        actors: selection,
        ...(target !== undefined ? { target } : {}),
        ...(queueMode !== undefined ? { queueMode } : {}),
      });
    }

    const shellService: RtsShellService = {
      state,

      selectBox(x, y, width, height) {
        selection = [...units.values()]
          .filter(
            (u) =>
              u.team === BLUE &&
              alive(u.id) &&
              u.x >= x &&
              u.x <= x + width &&
              u.y >= y &&
              u.y <= y + height,
          )
          .map((u) => u.id)
          .sort();
        return [...selection];
      },

      select(actorIds) {
        selection = [...actorIds];
        return [...selection];
      },

      clearSelection() {
        selection = [];
      },

      orderMove(col, row, queueMode) {
        const [x, y] = grid.cellToWorld(col, row);
        return issue('move', { kind: 'position', x, y }, queueMode);
      },

      orderAttack(targetId, queueMode) {
        return issue('attack', { kind: 'entity', entityId: targetId }, queueMode);
      },

      orderAttackMove(col, row, queueMode) {
        const [x, y] = grid.cellToWorld(col, row);
        return issue('attack-move', { kind: 'position', x, y }, queueMode);
      },

      orderHold(queueMode) {
        return issue('hold', { kind: 'none' }, queueMode);
      },

      orderStop() {
        let cancelled = 0;
        for (const id of selection) cancelled += orders.stop(id);
        return cancelled;
      },

      cancel: (orderId) => orders.cancel(orderId),
      order: (orderId) => orders.order(orderId),
      activeOf: (actorId) => orders.active(actorId),
      queueOf: (actorId) => orders.queue(actorId),

      defineSquad: (groupId, actorIds) => orders.defineGroup(groupId, actorIds),
      orderSquadHold: (groupId) => orders.issue({ kind: 'hold', groupId, target: { kind: 'none' } }),

      validateAction: (actionId, actorId, targetId) =>
        tactics.validate(actionId, actorId, { kind: 'entity', entityId: targetId }),
      executeAction: (actionId, actorId, targetId) =>
        tactics.execute(actionId, actorId, { kind: 'entity', entityId: targetId }),

      slay(actorId) {
        const health = combat.get(actorId);
        if (health.current > 0) combat.damage(actorId, health.current, 0);
        units.get(actorId)?.sprite.setAlpha(0.25);
      },

      cellOf(actorId) {
        const unit = units.get(actorId)!;
        return grid.worldToCell(unit.x, unit.y);
      },
    };

    const serviceHandle = context.capabilities.provide(RTS_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(RTS_SHELL_CAPABILITY_ID, state);

    // A camera nudge so the top-down controller is genuinely wired, matching
    // the preset's declared controller family.
    let cameraX = 0;
    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = topDownController.read(context.input);
        cameraX = Math.max(-120, Math.min(120, cameraX + intent.moveX * (240 * deltaMs) / 1000));
        scene.cameras.main.setScroll(cameraX, 0);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        resolvedWatch.dispose();
        debugHandle.dispose();
        serviceHandle.dispose();
        adapterHandle.dispose();
        for (const id of units.keys()) combat.remove(id);
        nav.remove('battlefield');
        try {
          for (const unit of units.values()) unit.sprite.destroy();
        } catch {
          /* tearing down */
        }
        units.clear();
        followers.clear();
      },
    };
  },
};
