/**
 * A lightweight game statistics tracker.
 *
 * Tracks common gameplay metrics (score, time played, deaths, pickups, etc.)
 * and provides a simple API for games to record and query stats. Stats are
 * optional and games can use as many or as few as they need.
 *
 * This is a pure data structure with no Phaser dependencies, so it can be
 * tested in isolation and used by any game type.
 */

export interface GameStats {
  readonly score: number;
  readonly highScore: number;
  readonly timePlayedMs: number;
  readonly deaths: number;
  readonly pickups: number;
  readonly enemiesDefeated: number;
  readonly levelsCompleted: number;
  readonly distanceTraveled: number;
  readonly custom: Readonly<Record<string, number>>;
}

export interface GameStatsService {
  /** Get the current stats snapshot. */
  readonly stats: GameStats;

  /** Add to the score. Negative values are allowed (penalties). */
  addScore(amount: number): void;

  /** Record a death. */
  recordDeath(): void;

  /** Record a pickup collected. */
  recordPickup(): void;

  /** Record an enemy defeated. */
  recordEnemyDefeated(): void;

  /** Record a level completed. */
  recordLevelCompleted(): void;

  /** Add distance traveled (in pixels or units). */
  addDistance(amount: number): void;

  /** Advance the time played counter. */
  advanceTime(deltaMs: number): void;

  /** Set a custom stat by key. */
  setCustom(key: string, value: number): void;

  /** Increment a custom stat by key. */
  incrementCustom(key: string, amount?: number): void;

  /** Reset all stats to zero. */
  reset(): void;

  /** Get a formatted summary string. */
  summary(): string;
}

/**
 * Creates a game stats service.
 *
 * Pure and deterministic except for the highScore which persists across resets
 * within the same service instance.
 */
export function createGameStatsService(): GameStatsService {
  let score = 0;
  let highScore = 0;
  let timePlayedMs = 0;
  let deaths = 0;
  let pickups = 0;
  let enemiesDefeated = 0;
  let levelsCompleted = 0;
  let distanceTraveled = 0;
  const custom: Record<string, number> = {};

  function getStats(): GameStats {
    return {
      score,
      highScore,
      timePlayedMs,
      deaths,
      pickups,
      enemiesDefeated,
      levelsCompleted,
      distanceTraveled,
      custom: { ...custom },
    };
  }

  function addScore(amount: number): void {
    score += amount;
    if (score > highScore) highScore = score;
  }

  function recordDeath(): void {
    deaths++;
  }

  function recordPickup(): void {
    pickups++;
  }

  function recordEnemyDefeated(): void {
    enemiesDefeated++;
  }

  function recordLevelCompleted(): void {
    levelsCompleted++;
  }

  function addDistance(amount: number): void {
    distanceTraveled += Math.abs(amount);
  }

  function advanceTime(deltaMs: number): void {
    timePlayedMs += deltaMs;
  }

  function setCustom(key: string, value: number): void {
    custom[key] = value;
  }

  function incrementCustom(key: string, amount = 1): void {
    custom[key] = (custom[key] ?? 0) + amount;
  }

  function reset(): void {
    score = 0;
    timePlayedMs = 0;
    deaths = 0;
    pickups = 0;
    enemiesDefeated = 0;
    levelsCompleted = 0;
    distanceTraveled = 0;
    for (const key of Object.keys(custom)) custom[key] = 0;
    // highScore persists across resets
  }

  function summary(): string {
    const minutes = Math.floor(timePlayedMs / 60000);
    const seconds = Math.floor((timePlayedMs % 60000) / 1000);
    return [
      `Score: ${score} (High: ${highScore})`,
      `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `Deaths: ${deaths}`,
      `Pickups: ${pickups}`,
      `Enemies: ${enemiesDefeated}`,
      `Levels: ${levelsCompleted}`,
      `Distance: ${Math.round(distanceTraveled)}`,
    ].join(' | ');
  }

  return {
    get stats() {
      return getStats();
    },
    addScore,
    recordDeath,
    recordPickup,
    recordEnemyDefeated,
    recordLevelCompleted,
    addDistance,
    advanceTime,
    setCustom,
    incrementCustom,
    reset,
    summary,
  };
}
