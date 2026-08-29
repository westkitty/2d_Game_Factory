import type {
  NormalizedLevel,
  WorldEntranceDefinition,
  WorldGraphService,
  WorldNodeDefinition,
  WorldTransitionResult,
} from '@sw2d/contracts';
import { WORLD_GRAPH_CAPABILITY_ID } from '@sw2d/contracts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Reusable room/location transition bridge (capability program Phase 8).
 *
 * The `world.graph` service owns the graph pointer and discovery state; this
 * bridge owns the *scene lifecycle* of a transition:
 *
 *   verify -> suppress input -> tear down the old room -> resolve the
 *   destination level -> build the new room at the destination entrance ->
 *   the graph is already marked discovered/visited -> restore input.
 *
 * The shell supplies `teardownRoom()` (dispose the current room's sprites /
 * colliders) and `buildRoom(level, entrance)` (create the destination room and
 * place the player at the entrance). The bridge never leaves both rooms
 * active, and a failed/blocked transition leaves the current room untouched.
 */

export interface RoomTransitionHooks {
  /** Dispose everything the current room owns. Called before the new room is built. */
  teardownRoom(): void;
  /** Build the destination room and place the player at `entrance`. */
  buildRoom(level: NormalizedLevel, entrance: WorldEntranceDefinition, node: WorldNodeDefinition): void;
}

export interface RoomTransitionRuntime {
  /** True during the frames immediately after a successful transition (input should be ignored). */
  readonly transitioning: boolean;
  /** Attempt a transition. Returns the graph result; a scene rebuild happens only when `ok`. */
  requestTransition(connectionId: string): WorldTransitionResult;
  /** Frames-since-last-transition guard for the shell's update loop. */
  tick(): void;
  readonly transitions: number;
  dispose(): void;
}

const INPUT_SUPPRESS_FRAMES = 4;

export function createRoomTransitionRuntime(context: SceneContext, hooks: RoomTransitionHooks): RoomTransitionRuntime {
  const graph = context.capabilities.require<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID);
  let suppress = 0;
  let transitions = 0;
  let disposed = false;

  function resolveLevel(node: WorldNodeDefinition): NormalizedLevel | undefined {
    const entry = context.content.data[node.level];
    return entry?.value as NormalizedLevel | undefined;
  }

  return {
    get transitioning() {
      return suppress > 0;
    },
    get transitions() {
      return transitions;
    },

    requestTransition(connectionId: string): WorldTransitionResult {
      if (disposed) return { ok: false, connectionId, reason: 'unknown-connection' };
      const result = graph.requestTransition(connectionId);
      if (!result.ok || result.toNodeId === undefined) return result;

      const destNode = graph.node(result.toNodeId);
      const level = destNode ? resolveLevel(destNode) : undefined;
      const entrance = destNode?.entrances.find((e) => e.id === result.toEntranceId);
      if (!destNode || !level || !entrance) {
        // The graph pointer already moved, but the destination content is
        // unusable. Fail safe: do NOT tear down the good room. Report it.
        return { ok: false, connectionId, reason: 'unknown-destination' };
      }

      suppress = INPUT_SUPPRESS_FRAMES;
      hooks.teardownRoom();
      hooks.buildRoom(level, entrance, destNode);
      transitions += 1;
      return result;
    },

    tick(): void {
      if (suppress > 0) suppress -= 1;
    },

    dispose(): void {
      disposed = true;
      suppress = 0;
    },
  };
}
