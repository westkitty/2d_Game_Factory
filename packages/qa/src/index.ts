/**
 * @sw2d/qa - the real-browser smoke harness.
 *
 * Launches the system-installed Chrome via `playwright-core` (no bundled
 * browser download), serves a production build on a free local port, drives
 * it, and asserts a terminal oracle. Dev-only; never imported by anything
 * that ships in a game build.
 */
export { findSystemChrome } from './browserPath.ts';
export { launchHarness, NoBrowserAvailableError, type Harness } from './harness.ts';
export { serveStatic, type StaticServerHandle } from './staticServer.ts';
export { runSmoke, type SmokeOutcome, type SmokeResult, type SmokeSpec } from './smokeRunner.ts';
export { readSnapshot, readShellState, type DebugSnapshotLike } from './snapshot.ts';
export { startPlay, waitUntil, holdUntil, pauseResume, restartRun, pointerAt, clickAt, shellReader } from './journey.ts';
export { buildRoomMap, routeRooms, readDungeon, walkTo, walkToRoom, fightNearestInRoom, type DungeonShell, type DungeonSnap, type DungeonEnemy, type RoomMap } from './dungeonJourney.ts';
export { leadPoint, aimAt, type AimTarget } from './shooterJourney.ts';
