import type { ActionId } from './actions.ts';
import type { Disposable } from './disposable.ts';

/** Identifies which physical device last drove an action. */
export type InputSourceId = 'keyboard' | 'pointer' | 'touch' | 'gamepad' | 'script';

/**
 * Physical bindings for one semantic action.
 *
 * `keyboard` holds KeyboardEvent.code values ('ArrowLeft', 'KeyA') rather than
 * `key` values, so bindings survive layout and modifier differences.
 * `pointerTargets` holds values matched against a DOM element's
 * `data-sw2d-action` attribute, which is how on-screen/touch controls bind.
 */
export interface ActionBinding {
  readonly keyboard?: readonly string[];
  readonly pointerTargets?: readonly string[];
}

export type ActionBindings = Readonly<Partial<Record<ActionId, ActionBinding>>>;

export interface ActionState {
  /** Held this frame. */
  readonly down: boolean;
  /** Transitioned to down during this frame. */
  readonly justPressed: boolean;
  /** Transitioned to up during this frame. */
  readonly justReleased: boolean;
  /** Analog magnitude, 0..1. Digital devices report 0 or 1. */
  readonly value: number;
  /** Device that last changed this action, or null if never driven. */
  readonly source: InputSourceId | null;
}

/**
 * Read-only action state, as seen by gameplay code.
 *
 * Frame advancement is deliberately absent: only the runtime host advances
 * edges, so a system pack cannot corrupt another pack's just-pressed reads.
 */
export interface ActionInput {
  isDown(action: ActionId): boolean;
  justPressed(action: ActionId): boolean;
  justReleased(action: ActionId): boolean;
  value(action: ActionId): number;
  /** Convenience for opposed pairs. Returns positive value minus negative value. */
  axis(negative: ActionId, positive: ActionId): number;
  state(action: ActionId): ActionState;
  /**
   * Claim this frame's press so no other reader sees it.
   *
   * Returns whether the action was just pressed, and if so clears the edge for
   * the rest of the frame. This is how one physical press produces exactly one
   * effect even when several layers are alive at once - a menu resuming gameplay
   * must not also be seen by the gameplay scene it just resumed. Holding is
   * unaffected: `isDown` still reports true.
   */
  consumePress(action: ActionId): boolean;
  /** Flat snapshot of analog values, for debug output and automated QA. */
  values(): Readonly<Record<ActionId, number>>;
  readonly bindings: ActionBindings;
}

/** What an adapter writes into. Adapters never touch action edges themselves. */
export interface ActionSink {
  setActionValue(action: ActionId, value: number, source: InputSourceId): void;
}

/**
 * A physical device translator. One adapter per device family.
 *
 * Adapters are owned by the runtime's input host and disposed with it, which is
 * what prevents duplicated listeners across restarts.
 */
export interface InputDeviceAdapter extends Disposable {
  readonly sourceId: InputSourceId;
  /** Re-read bindings after a remap. Must not accumulate listeners. */
  applyBindings(bindings: ActionBindings): void;
  /** Optional per-frame polling hook for devices without events (e.g. gamepad). */
  poll?(): void;
}
