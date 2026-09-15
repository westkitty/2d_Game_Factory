/**
 * Tests for the achievement system.
 */

import { describe, it, expect } from 'vitest';
import { createAchievementService, AchievementConditions, type Achievement } from '../src/game-support/achievements.ts';

const baseContext = {
  score: 0,
  timePlayedMs: 0,
  deaths: 0,
  pickups: 0,
  enemiesDefeated: 0,
  levelsCompleted: 0,
  distanceTraveled: 0,
  custom: {},
};

const testAchievements: readonly Achievement[] = [
  { id: 'first-blood', title: 'First Blood', description: 'Defeat an enemy', condition: AchievementConditions.enemiesAtLeast(1) },
  { id: 'century', title: 'Century', description: 'Score 100 points', condition: AchievementConditions.scoreAtLeast(100) },
  { id: 'survivor', title: 'Survivor', description: 'Play for 5 minutes', condition: AchievementConditions.playedFor(300000) },
  { id: 'flawless', title: 'Flawless', description: 'Complete a level without dying', condition: (ctx) => ctx.levelsCompleted >= 1 && ctx.deaths === 0 },
];

describe('createAchievementService', () => {
  it('starts with no achievements unlocked', () => {
    const service = createAchievementService(testAchievements);
    expect(service.state.unlocked.size).toBe(0);
    expect(service.progress.unlocked).toBe(0);
    expect(service.progress.total).toBe(4);
  });

  it('unlocks achievements when conditions are met', () => {
    const service = createAchievementService(testAchievements);
    const newlyUnlocked = service.check({ ...baseContext, enemiesDefeated: 1 });
    expect(newlyUnlocked).toContain('first-blood');
    expect(service.isUnlocked('first-blood')).toBe(true);
  });

  it('does not re-unlock already unlocked achievements', () => {
    const service = createAchievementService(testAchievements);
    service.check({ ...baseContext, enemiesDefeated: 1 });
    const secondCheck = service.check({ ...baseContext, enemiesDefeated: 2 });
    expect(secondCheck).not.toContain('first-blood');
  });

  it('unlocks multiple achievements at once', () => {
    const service = createAchievementService(testAchievements);
    const newlyUnlocked = service.check({ ...baseContext, score: 150, enemiesDefeated: 3 });
    expect(newlyUnlocked).toContain('first-blood');
    expect(newlyUnlocked).toContain('century');
  });

  it('tracks progress percentage', () => {
    const service = createAchievementService(testAchievements);
    service.check({ ...baseContext, enemiesDefeated: 1 });
    expect(service.progress.percentage).toBe(25);
  });

  it('resets all achievements', () => {
    const service = createAchievementService(testAchievements);
    service.check({ ...baseContext, enemiesDefeated: 1, score: 200 });
    expect(service.progress.unlocked).toBe(2);
    service.reset();
    expect(service.progress.unlocked).toBe(0);
  });

  it('handles failing conditions gracefully', () => {
    const achievements: readonly Achievement[] = [
      { id: 'broken', title: 'Broken', description: 'Always throws', condition: () => { throw new Error('boom'); } },
      { id: 'working', title: 'Working', description: 'Always true', condition: () => true },
    ];
    const service = createAchievementService(achievements);
    const result = service.check(baseContext);
    expect(result).toContain('working');
    expect(result).not.toContain('broken');
  });

  it('AchievementConditions builders work correctly', () => {
    expect(AchievementConditions.scoreAtLeast(100)({ ...baseContext, score: 100 })).toBe(true);
    expect(AchievementConditions.scoreAtLeast(100)({ ...baseContext, score: 99 })).toBe(false);
    expect(AchievementConditions.noDeaths()(baseContext)).toBe(true);
    expect(AchievementConditions.noDeaths()({ ...baseContext, deaths: 1 })).toBe(false);
    expect(AchievementConditions.customAtLeast('combo', 5)({ ...baseContext, custom: { combo: 5 } })).toBe(true);
  });
});
