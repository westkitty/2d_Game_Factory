/**
 * Achievement system for generated games.
 *
 * A lightweight, data-driven achievement tracker. Achievements are defined
 * as plain objects with a condition function, and the system checks them
 * against the current game state each frame.
 *
 * Pure and deterministic - achievements are checked against supplied state,
 * not wall-clock time or random values.
 */

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon?: string;
  readonly condition: (state: AchievementContext) => boolean;
}

export interface AchievementContext {
  readonly score: number;
  readonly timePlayedMs: number;
  readonly deaths: number;
  readonly pickups: number;
  readonly enemiesDefeated: number;
  readonly levelsCompleted: number;
  readonly distanceTraveled: number;
  readonly custom: Readonly<Record<string, number>>;
}

export interface AchievementState {
  readonly unlocked: ReadonlySet<string>;
  readonly justUnlocked: readonly string[];
}

export interface AchievementService {
  /** Get the current achievement state. */
  readonly state: AchievementState;

  /** Check all achievements against the current context. Returns newly unlocked IDs. */
  check(context: AchievementContext): readonly string[];

  /** Check if a specific achievement is unlocked. */
  isUnlocked(id: string): boolean;

  /** Get all registered achievements. */
  readonly achievements: readonly Achievement[];

  /** Get the unlock progress (unlocked / total). */
  readonly progress: { unlocked: number; total: number; percentage: number };

  /** Reset all achievements. */
  reset(): void;
}

/**
 * Creates an achievement service with the given achievement definitions.
 */
export function createAchievementService(definitions: readonly Achievement[]): AchievementService {
  const unlocked = new Set<string>();
  let justUnlocked: string[] = [];

  function check(context: AchievementContext): readonly string[] {
    justUnlocked = [];
    for (const achievement of definitions) {
      if (unlocked.has(achievement.id)) continue;
      try {
        if (achievement.condition(context)) {
          unlocked.add(achievement.id);
          justUnlocked.push(achievement.id);
        }
      } catch {
        // A failing condition is not a crash - skip this achievement
      }
    }
    return justUnlocked;
  }

  return {
    get state() {
      return { unlocked, justUnlocked };
    },
    check,
    isUnlocked(id: string) {
      return unlocked.has(id);
    },
    get achievements() {
      return definitions;
    },
    get progress() {
      return {
        unlocked: unlocked.size,
        total: definitions.length,
        percentage: definitions.length > 0 ? (unlocked.size / definitions.length) * 100 : 0,
      };
    },
    reset() {
      unlocked.clear();
      justUnlocked = [];
    },
  };
}

/** Common achievement condition builders. */
export const AchievementConditions = {
  /** Unlock when score reaches a threshold. */
  scoreAtLeast: (threshold: number) => (ctx: AchievementContext): boolean => ctx.score >= threshold,

  /** Unlock when time played reaches a threshold. */
  playedFor: (ms: number) => (ctx: AchievementContext): boolean => ctx.timePlayedMs >= ms,

  /** Unlock when deaths reach a threshold (ironic achievements). */
  deathsAtLeast: (count: number) => (ctx: AchievementContext): boolean => ctx.deaths >= count,

  /** Unlock when no deaths have occurred. */
  noDeaths: () => (ctx: AchievementContext): boolean => ctx.deaths === 0,

  /** Unlock when pickups reach a threshold. */
  pickupsAtLeast: (count: number) => (ctx: AchievementContext): boolean => ctx.pickups >= count,

  /** Unlock when enemies defeated reach a threshold. */
  enemiesAtLeast: (count: number) => (ctx: AchievementContext): boolean => ctx.enemiesDefeated >= count,

  /** Unlock when levels completed reach a threshold. */
  levelsAtLeast: (count: number) => (ctx: AchievementContext): boolean => ctx.levelsCompleted >= count,

  /** Unlock when a custom stat reaches a threshold. */
  customAtLeast: (key: string, threshold: number) => (ctx: AchievementContext): boolean => (ctx.custom[key] ?? 0) >= threshold,
};
