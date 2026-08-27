import { describe, expect, it } from 'vitest';
import { starterKit as explorationGame } from '../server/starterKits/expanded/exploration-game.ts';
import { starterKit as horizontalShmup } from '../server/starterKits/expanded/horizontal-shmup.ts';
import { starterKit as laneDefense } from '../server/starterKits/expanded/lane-defense.ts';
import { starterKit as mazeGame } from '../server/starterKits/expanded/maze-game.ts';
import { starterKit as runAndGun } from '../server/starterKits/expanded/run-and-gun.ts';
import { starterKit as verticalShmup } from '../server/starterKits/expanded/vertical-shmup.ts';

function shell(kit: { overlay(gameId: string, displayName: string): ReadonlyMap<string, string> }): string {
  const source = kit.overlay('role-proof', 'Role Proof').get('src/game-specific/shellPack.ts');
  if (!source) throw new Error('starter kit did not emit shellPack.ts');
  return source;
}

describe('P2-C semantic role presentation', () => {
  it('keeps the exploration checkpoint role visible when supplied', () => {
    const source = shell(explorationGame);
    expect(source).toContain("context.assets.has('checkpoint')");
    expect(source).toContain("context.assets.resolve('checkpoint')");
  });

  it('keeps horizontal SHMUP exit and particle roles in visible presentation', () => {
    const source = shell(horizontalShmup);
    expect(source).toContain("context.assets.resolve('exit')");
    expect(source).toContain("context.assets.has('particle')");
    expect(source).toContain("context.assets.resolve('particle')");
  });

  it('renders lane defenders with the declared pickup role', () => {
    expect(shell(laneDefense)).toContain("context.assets.resolve('pickup')");
  });

  it('renders maze walls, pickup and exit through their semantic roles', () => {
    const source = shell(mazeGame);
    expect(source).toContain("context.assets.resolve('platform')");
    expect(source).toContain("context.assets.resolve('pickup')");
    expect(source).toContain("context.assets.resolve('exit')");
  });

  it('keeps Run-and-Gun hazard, exit and particle presentation explicit', () => {
    const source = shell(runAndGun);
    expect(source).toContain("context.assets.resolve('hazard')");
    expect(source).toContain("context.assets.resolve('exit')");
    expect(source).toContain("context.assets.has('particle')");
    expect(source).toContain("context.assets.resolve('particle')");
  });

  it('keeps vertical SHMUP particle hit effects semantic and optional', () => {
    const source = shell(verticalShmup);
    expect(source).toContain("context.assets.has('particle')");
    expect(source).toContain("context.assets.resolve('particle')");
  });
});
