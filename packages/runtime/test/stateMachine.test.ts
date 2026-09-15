/**
 * Tests for the state machine.
 */

import { describe, it, expect, vi } from 'vitest';
import { createStateMachine } from '../src/game-support/stateMachine.ts';

type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';
type GameEvent = 'START' | 'PAUSE' | 'RESUME' | 'DIE' | 'QUIT';

const gameConfig = {
  initial: 'menu' as GameState,
  states: {
    menu: {
      on: {
        START: { target: 'playing' as GameState },
      },
    },
    playing: {
      on: {
        PAUSE: { target: 'paused' as GameState },
        DIE: { target: 'gameOver' as GameState },
        QUIT: { target: 'menu' as GameState },
      },
    },
    paused: {
      on: {
        RESUME: { target: 'playing' as GameState },
        QUIT: { target: 'menu' as GameState },
      },
    },
    gameOver: {
      on: {
        START: { target: 'playing' as GameState },
        QUIT: { target: 'menu' as GameState },
      },
    },
  } as const,
};

describe('createStateMachine', () => {
  it('starts in the initial state', () => {
    const sm = createStateMachine(gameConfig);
    expect(sm.current).toBe('menu');
  });

  it('transitions on valid events', () => {
    const sm = createStateMachine(gameConfig);
    expect(sm.send('START')).toBe(true);
    expect(sm.current).toBe('playing');
  });

  it('ignores invalid events', () => {
    const sm = createStateMachine(gameConfig);
    expect(sm.send('PAUSE')).toBe(false); // Can't pause from menu
    expect(sm.current).toBe('menu');
  });

  it('supports complex transition chains', () => {
    const sm = createStateMachine(gameConfig);
    sm.send('START');
    sm.send('PAUSE');
    sm.send('RESUME');
    sm.send('DIE');
    expect(sm.current).toBe('gameOver');
  });

  it('reports available events', () => {
    const sm = createStateMachine(gameConfig);
    expect(sm.availableEvents).toContain('START');
    expect(sm.availableEvents).not.toContain('PAUSE');

    sm.send('START');
    expect(sm.availableEvents).toContain('PAUSE');
    expect(sm.availableEvents).toContain('DIE');
    expect(sm.availableEvents).toContain('QUIT');
  });

  it('can() checks if an event is valid', () => {
    const sm = createStateMachine(gameConfig);
    expect(sm.can('START')).toBe(true);
    expect(sm.can('PAUSE')).toBe(false);
  });

  it('respects guards', () => {
    let hasHealth = true;
    const config = {
      initial: 'alive' as const,
      states: {
        alive: {
          on: {
            HIT: { target: 'dead' as const, guard: () => !hasHealth },
          },
        },
        dead: {
          on: {},
        },
      },
    };

    const sm = createStateMachine(config);
    expect(sm.send('HIT')).toBe(false); // Guard fails
    expect(sm.current).toBe('alive');

    hasHealth = false;
    expect(sm.send('HIT')).toBe(true); // Guard passes
    expect(sm.current).toBe('dead');
  });

  it('fires entry and exit actions', () => {
    const onEntry = vi.fn();
    const onExit = vi.fn();
    const config = {
      initial: 'a' as const,
      states: {
        a: {
          on: { GO: { target: 'b' as const } },
          onExit,
        },
        b: {
          on: {},
          onEntry,
        },
      },
    };

    const sm = createStateMachine(config);
    sm.send('GO');
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onEntry).toHaveBeenCalledTimes(1);
  });

  it('records transition history', () => {
    const sm = createStateMachine(gameConfig);
    sm.send('START');
    sm.send('PAUSE');
    sm.send('RESUME');

    expect(sm.history).toHaveLength(3);
    expect(sm.history[0]).toMatchObject({ from: 'menu', to: 'playing', event: 'START' });
    expect(sm.history[1]).toMatchObject({ from: 'playing', to: 'paused', event: 'PAUSE' });
    expect(sm.history[2]).toMatchObject({ from: 'paused', to: 'playing', event: 'RESUME' });
  });

  it('forceState bypasses guards', () => {
    const sm = createStateMachine(gameConfig);
    sm.forceState('gameOver');
    expect(sm.current).toBe('gameOver');
  });
});
