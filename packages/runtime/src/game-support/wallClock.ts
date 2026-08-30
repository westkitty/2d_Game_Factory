/**
 * The wall clock (post-ten program Phase 19).
 *
 * The one legitimate reason a game reads real time is to answer "how long was
 * the player away", and that question is asked exactly once, at the load/resume
 * boundary. Everything else - production, customers, queues, needs, physics -
 * runs on `deltaMs`, because simulated time pauses when the game pauses and
 * real time does not.
 *
 * Injecting it means no contract and no pack ever calls `Date.now()` directly,
 * so a test can move a week without moving the machine, and a determinism audit
 * has one place to look.
 */

import type { WallClock } from '@sw2d/contracts';

/**
 * `Date.now()` - the epoch clock, not `performance.now()`. Absence has to
 * survive the page being closed, and a monotonic clock resets when it is.
 */
export class BrowserWallClock implements WallClock {
  now(): number {
    return Date.now();
  }
}

// The manual clock lives in @sw2d/contracts beside the `WallClock` interface,
// so there is one implementation rather than one per package.
export { ManualWallClock } from '@sw2d/contracts';
