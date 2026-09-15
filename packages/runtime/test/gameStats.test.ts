/**
 * Tests for the game stats service.
 */

import { describe, it, expect } from 'vitest';
import { createGameStatsService } from '../src/game-support/gameStats.ts';

describe('createGameStatsService', () => {
  it('starts with zero stats', () => {
    const stats = createGameStatsService();
    expect(stats.stats.score).toBe(0);
    expect(stats.stats.highScore).toBe(0);
    expect(stats.stats.timePlayedMs).toBe(0);
    expect(stats.stats.deaths).toBe(0);
    expect(stats.stats.pickups).toBe(0);
    expect(stats.stats.enemiesDefeated).toBe(0);
    expect(stats.stats.levelsCompleted).toBe(0);
    expect(stats.stats.distanceTraveled).toBe(0);
  });

  it('tracks score and high score', () => {
    const stats = createGameStatsService();
    stats.addScore(100);
    expect(stats.stats.score).toBe(100);
    expect(stats.stats.highScore).toBe(100);

    stats.addScore(50);
    expect(stats.stats.score).toBe(150);
    expect(stats.stats.highScore).toBe(150);

    stats.reset();
    expect(stats.stats.score).toBe(0);
    expect(stats.stats.highScore).toBe(150); // High score persists
  });

  it('tracks deaths, pickups, and enemies', () => {
    const stats = createGameStatsService();
    stats.recordDeath();
    stats.recordDeath();
    expect(stats.stats.deaths).toBe(2);

    stats.recordPickup();
    stats.recordPickup();
    stats.recordPickup();
    expect(stats.stats.pickups).toBe(3);

    stats.recordEnemyDefeated();
    expect(stats.stats.enemiesDefeated).toBe(1);
  });

  it('tracks time played', () => {
    const stats = createGameStatsService();
    stats.advanceTime(1000);
    stats.advanceTime(500);
    expect(stats.stats.timePlayedMs).toBe(1500);
  });

  it('tracks distance traveled', () => {
    const stats = createGameStatsService();
    stats.addDistance(100);
    stats.addDistance(-50); // Negative values become positive
    expect(stats.stats.distanceTraveled).toBe(150);
  });

  it('supports custom stats', () => {
    const stats = createGameStatsService();
    stats.setCustom('combo', 5);
    expect(stats.stats.custom.combo).toBe(5);

    stats.incrementCustom('combo', 3);
    expect(stats.stats.custom.combo).toBe(8);

    stats.incrementCustom('newStat');
    expect(stats.stats.custom.newStat).toBe(1);
  });

  it('resets all stats except high score', () => {
    const stats = createGameStatsService();
    stats.addScore(1000);
    stats.recordDeath();
    stats.recordPickup();
    stats.setCustom('test', 42);

    stats.reset();

    expect(stats.stats.score).toBe(0);
    expect(stats.stats.highScore).toBe(1000);
    expect(stats.stats.deaths).toBe(0);
    expect(stats.stats.pickups).toBe(0);
    expect(stats.stats.custom.test).toBe(0);
  });

  it('provides a formatted summary', () => {
    const stats = createGameStatsService();
    stats.addScore(500);
    stats.advanceTime(65000); // 1:05
    stats.recordDeath();

    const summary = stats.summary();
    expect(summary).toContain('Score: 500');
    expect(summary).toContain('Time: 1:05');
    expect(summary).toContain('Deaths: 1');
  });
});
