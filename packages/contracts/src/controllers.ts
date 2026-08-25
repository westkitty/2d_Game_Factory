import type { ActionInput } from './input.ts';

/**
 * A controller family: a pure interpretation of the current ActionInput
 * state into reusable intent.
 *
 * Controllers answer "what does the player intend?" - never "how does the
 * body move, race, navigate or fire?" That stays with movement/gameplay
 * system packs. A controller reads `ActionInput`; it never owns physical
 * listeners, never advances a frame, and never touches Phaser. See
 * `MASTER_PROJECT.md` Phase 3 and
 * `docs/architecture/adr/0003-semantic-input-ownership.md`.
 */
export interface Controller<TIntent> {
  /** Compute this frame's intent from the current ActionInput state. */
  read(input: ActionInput): TIntent;
}

/**
 * Platform family: side-view movement intent (running, jumping, dashing).
 *
 * No gravity, collision, coyote time, jump buffering, wall-jump or variable
 * jump height here - those are movement-system concerns that interpret this
 * intent, not part of it.
 */
export interface PlatformIntent {
  /** -1 (full left) .. 1 (full right). */
  readonly moveAxis: number;
  /**
   * Claimed this frame via `ActionInput.consumePress` - true for at most one
   * reader, once per physical press. Jump-trigger is a discrete,
   * single-owner decision, the same class of read as pause/resume/confirm.
   */
  readonly jumpPressed: boolean;
  /** Plain, non-claiming read. Many systems may observe this freely. */
  readonly jumpHeld: boolean;
  readonly dashPressed: boolean;
  readonly dashHeld: boolean;
  readonly primaryPressed: boolean;
  readonly secondaryPressed: boolean;
  readonly interactPressed: boolean;
}

/**
 * Top-down family: 4/8-way or analog movement intent.
 *
 * No velocity, collision, navigation or combat here - only intent.
 */
export interface TopDownIntent {
  /** -1..1. */
  readonly moveX: number;
  /** -1..1. */
  readonly moveY: number;
  /**
   * 0..1. `(moveX, moveY)` is scaled so its length never exceeds 1: holding
   * two cardinal directions at once (e.g. up+right) does not move faster
   * than holding one. This bound is part of the contract, not an incidental
   * clamp.
   */
  readonly moveMagnitude: number;
  readonly primaryPressed: boolean;
  readonly secondaryPressed: boolean;
  readonly dashPressed: boolean;
  readonly dashHeld: boolean;
  readonly interactPressed: boolean;
}

/**
 * Vehicle family: arcade steering/throttle intent.
 *
 * No vehicle physics, drift equations, lap logic or racing rules here.
 */
export interface VehicleIntent {
  /** -1 (steer left) .. 1 (steer right). */
  readonly steering: number;
  /** 0..1. */
  readonly throttle: number;
  /** 0..1. Brake or reverse intent - which one applies is the vehicle system's decision, not the controller's. */
  readonly brake: number;
  readonly boostPressed: boolean;
  readonly boostHeld: boolean;
  readonly secondaryPressed: boolean;
}

/** Grid family: one discrete directional step per physical press. */
export type GridDirection = 'up' | 'down' | 'left' | 'right';

export interface GridIntent {
  /**
   * The single direction newly pressed this frame, or null when nothing
   * transitioned to pressed. Never more than one direction per frame: if
   * several movement actions transition to pressed in the same frame,
   * priority is up > down > left > right.
   */
  readonly step: GridDirection | null;
  readonly confirmPressed: boolean;
  readonly cancelPressed: boolean;
}

/**
 * Pointer/action family: the semantic actions the current input layer
 * honestly supports for pointer/touch-driven interaction.
 *
 * `ActionInput` has no cursor coordinates, hover state or drag deltas, so
 * this intent does not invent them. A spatial pointer service - world-space
 * cursor position, hover targets, drag vectors - is a bounded future
 * capability, not implemented here; see `docs/architecture/ARCHITECTURE_OVERVIEW.md`.
 */
export interface PointerActionIntent {
  readonly primaryPressed: boolean;
  readonly secondaryPressed: boolean;
  readonly interactPressed: boolean;
  readonly confirmPressed: boolean;
  readonly cancelPressed: boolean;
}

/**
 * UI/simulation family: menu-style navigation and mode-changing intent.
 *
 * Does not change scenes, implement menus/widgets, or own timers/economy -
 * it only interprets intent for whatever consumes it.
 */
export interface UiSimulationIntent {
  readonly navigateLeftPressed: boolean;
  readonly navigateRightPressed: boolean;
  readonly navigateUpPressed: boolean;
  readonly navigateDownPressed: boolean;
  /** Claimed via `ActionInput.consumePress` - see PlatformIntent.jumpPressed. */
  readonly confirmPressed: boolean;
  /** Claimed. */
  readonly cancelPressed: boolean;
  /** Claimed. */
  readonly pausePressed: boolean;
  /** Plain, non-claiming read. */
  readonly primaryPressed: boolean;
}
