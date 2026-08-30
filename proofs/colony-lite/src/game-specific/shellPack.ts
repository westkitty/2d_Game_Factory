import {
  SIMULATION_AGENTS_CAPABILITY_ID,
  type AgentState,
  type InstalledSystemPack,
  type SimulationAgentsService,
  type SimulationClock,
  type WorkOrder,
} from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 18 proof - colony-lite.
 *
 * The half of the capability the pet proof does not reach: several agents at
 * once, tag-gated work orders, exclusive reservations, priority ordering, and
 * the release paths that stop a departed colonist from holding a job forever.
 *
 * The shell assigns work by asking the capability what is next for an agent and
 * reserving it. It never picks an order itself, never tracks who holds what, and
 * never decides when a job is done - all three belong to the service, and all
 * three are what a colony sim gets wrong when they are re-implemented per game.
 */

export const COLONY_SHELL_CAPABILITY_ID = 'game.colony-shell';

export interface ColonyShellState {
  readonly clock: SimulationClock;
  readonly agents: readonly AgentState[];
  readonly orders: readonly WorkOrder[];
  readonly openOrders: number;
  readonly completedOrders: readonly string[];
  readonly releasedOrders: readonly string[];
  readonly friendship: number;
  readonly startedBehaviors: readonly string[];
}

export interface ColonyShellService {
  state(): ColonyShellState;
  /** Ask the capability what this agent should do next, and claim it. */
  assignNext(agentId: string): { orderId: string | null; reserved: boolean };
  reserve(orderId: string, agentId: string): boolean;
  release(orderId: string): boolean;
  cancel(orderId: string): boolean;
  /** Remove a colonist mid-job, to prove the reservation is not leaked. */
  dismiss(agentId: string): boolean;
  nextFor(agentId: string): WorkOrder | null;
  drain(agentId: string, needId: string, amount: number): number | null;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: COLONY_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [COLONY_SHELL_CAPABILITY_ID],
  dependencies: [SIMULATION_AGENTS_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const agents = context.capabilities.require<SimulationAgentsService>(SIMULATION_AGENTS_CAPABILITY_ID);

    const SPAWNS: Readonly<Record<string, { x: number; y: number }>> = {
      hauler: { x: 320, y: 300 },
      builder: { x: 620, y: 300 },
    };
    for (const id of ['hauler', 'builder']) agents.spawn(id, id);

    const sprites = new Map<string, Phaser.GameObjects.Sprite>();
    for (const [id, at] of Object.entries(SPAWNS)) {
      sprites.set(id, scene.add.sprite(at.x, at.y, context.assets.resolve('player')));
    }

    const completedOrders: string[] = [];
    const releasedOrders: string[] = [];
    const startedBehaviors: string[] = [];

    const watches = [
      context.events.on('agents:workOrderCompleted', (p) => completedOrders.push(p.orderId)),
      context.events.on('agents:behaviorStarted', (p) => startedBehaviors.push(`${p.agentId}:${p.behaviorId}`)),
    ];

    function state(): ColonyShellState {
      const orders = agents.workOrders();
      return {
        clock: agents.clock(),
        agents: agents.agents(),
        orders,
        openOrders: orders.filter((order) => order.state === 'open').length,
        completedOrders: [...completedOrders],
        releasedOrders: [...releasedOrders],
        friendship: agents.relationship('hauler', 'builder', 'friendship'),
        startedBehaviors: [...startedBehaviors],
      };
    }

    const shellService: ColonyShellService = {
      state,
      assignNext(agentId) {
        // Ask, then claim. The shell does not choose - priority and tag gating
        // are the capability's rules, not this game's.
        const next = agents.nextWorkOrderFor(agentId);
        if (!next) return { orderId: null, reserved: false };
        return { orderId: next.id, reserved: agents.reserveWorkOrder(next.id, agentId) };
      },
      reserve: (orderId, agentId) => agents.reserveWorkOrder(orderId, agentId),
      release(orderId) {
        const released = agents.releaseWorkOrder(orderId);
        if (released) releasedOrders.push(orderId);
        return released;
      },
      cancel: (orderId) => agents.cancelWorkOrder(orderId),
      dismiss(agentId) {
        const gone = agents.despawn(agentId);
        if (gone) sprites.get(agentId)?.setVisible(false);
        return gone;
      },
      nextFor: (agentId) => agents.nextWorkOrderFor(agentId) ?? null,
      drain: (agentId, needId, amount) => agents.adjustNeed(agentId, needId, -amount)?.value ?? null,
      reset() {
        agents.reset();
        for (const id of ['hauler', 'builder']) {
          agents.spawn(id, id);
          sprites.get(id)?.setVisible(true);
        }
        completedOrders.length = 0;
        releasedOrders.length = 0;
        startedBehaviors.length = 0;
      },
    };

    const serviceHandle = context.capabilities.provide(COLONY_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(COLONY_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: COLONY_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        // Presentation only: a colonist holding a job reads as busy.
        for (const agent of agents.agents()) {
          sprites.get(agent.agentId)?.setAlpha(agent.workOrderId === null ? 0.6 : 1);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const watch of watches) watch.dispose();
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          for (const sprite of sprites.values()) sprite.destroy();
        } catch {
          /* tearing down */
        }
        sprites.clear();
      },
    };
  },
};
