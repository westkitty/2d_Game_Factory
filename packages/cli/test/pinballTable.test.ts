import { describe, expect, it } from 'vitest';
import type { GameContext, PinballCatalog, PinballService } from '@sw2d/contracts';
import { PINBALL_CAPABILITY_ID } from '@sw2d/contracts';
import { pinballPack } from '@sw2d/packs';
import { generatePinballCatalog } from '../src/generator/contentDocuments.ts';
import { FakeCapabilityRegistry, FakeEventBus } from '../../packs/test/testSupport.ts';

/**
 * Category-C convergence: the generated pinball-lite table must be a game a
 * player has to play. The first Wave-30 table dropped the ball straight onto
 * a centre bumper and completed with zero input. This suite simulates the
 * generated catalog through the real `sw2d.pinball` pack and pins both
 * halves: hands-off never reaches the win score (the ball drains and resets),
 * and a flipper kicked while the ball is over it does.
 */

function install(catalog: PinballCatalog): PinballService {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  pinballPack.install(
    { events, capabilities, content: { data: { pinball: { schemaId: 'x', valid: true, value: catalog } } } } as unknown as GameContext,
    undefined,
  );
  return capabilities.require<PinballService>(PINBALL_CAPABILITY_ID);
}

const TABLE = generatePinballCatalog('table') as unknown as PinballCatalog;
const FRAME_MS = 16.67;

describe('generated pinball-lite table', () => {
  it('never completes on its own: with no flips the ball drains, consumes balls, and game-overs at zero', () => {
    const table = install(TABLE);
    let drains = 0;
    let previous: string | null = null;
    for (let frame = 0; frame < 1200; frame++) {
      table.tick(FRAME_MS);
      const last = table.lastResult();
      if (last === 'drain' && previous !== 'drain') drains += 1;
      previous = last;
    }
    expect(table.outcome()).toBe('failed');
    expect(table.lastResult()).toBe('game-over');
    expect(table.score()).toBe(0);
    expect(table.ballsRemaining()).toBe(0);
    expect(drains).toBeGreaterThanOrEqual(1);
  });

  it('completes when the player flips while the ball is over a flipper', () => {
    const table = install(TABLE);
    let flips = 0;
    for (let frame = 0; frame < 1200 && table.outcome() === 'playing'; frame++) {
      table.tick(FRAME_MS);
      for (const flipper of TABLE.flippers ?? []) {
        if (Math.abs(table.ballX() - flipper.x) <= flipper.halfWidth && Math.abs(table.ballY() - flipper.y) <= 36) {
          table.flip(flipper.id as 'left' | 'right');
          flips += 1;
        }
      }
    }
    expect(table.outcome()).toBe('complete');
    expect(table.score()).toBe(TABLE.winScore);
    expect(flips).toBeGreaterThan(0);
  });

  it('a flip with the ball nowhere near the flipper is inert (no free kick)', () => {
    const table = install(TABLE);
    table.tick(FRAME_MS);
    const before = { x: table.ballX(), y: table.ballY() };
    table.flip('left');
    table.flip('right');
    expect(table.lastResult() ?? '').not.toMatch(/^flip-/);
    table.tick(FRAME_MS);
    expect(table.ballY()).toBeGreaterThan(before.y);
  });
});
