import { describe, expect, it } from 'vitest';
import type { CapabilityId } from '@sw2d/contracts';
import { resolveInstallOrder } from '../src/core/resolveInstallOrder.ts';

interface FakePack {
  readonly id: string;
  readonly provides: readonly CapabilityId[];
  readonly dependencies: readonly CapabilityId[];
}

function registryOf(...packs: FakePack[]): ReadonlyMap<string, FakePack> {
  return new Map(packs.map((pack) => [pack.id, pack]));
}

describe('resolveInstallOrder', () => {
  it('orders packs so every dependency installs first', () => {
    const registry = registryOf(
      { id: 'ui', provides: ['ui.hud'], dependencies: ['combat.health'] },
      { id: 'combat', provides: ['combat.health'], dependencies: ['world.bounds'] },
      { id: 'world', provides: ['world.bounds'], dependencies: [] },
    );

    const order = resolveInstallOrder(
      [{ packId: 'ui' }, { packId: 'combat' }, { packId: 'world' }],
      { registry, preexisting: [] },
    );

    expect(order.map((s) => s.packId)).toEqual(['world', 'combat', 'ui']);
  });

  it('is deterministic for independent packs, preserving selection order', () => {
    const registry = registryOf(
      { id: 'a', provides: ['cap.a'], dependencies: [] },
      { id: 'b', provides: ['cap.b'], dependencies: [] },
      { id: 'c', provides: ['cap.c'], dependencies: [] },
    );
    const selections = [{ packId: 'b' }, { packId: 'c' }, { packId: 'a' }];

    const first = resolveInstallOrder(selections, { registry, preexisting: [] });
    const second = resolveInstallOrder(selections, { registry, preexisting: [] });

    expect(first.map((s) => s.packId)).toEqual(['b', 'c', 'a']);
    expect(second).toEqual(first);
  });

  it('accepts a dependency already provided by the host', () => {
    const registry = registryOf({ id: 'combat', provides: ['combat.health'], dependencies: ['core.input'] });

    const order = resolveInstallOrder([{ packId: 'combat' }], {
      registry,
      preexisting: ['core.input'],
    });

    expect(order.map((s) => s.packId)).toEqual(['combat']);
  });

  it('names the pack and the capability nobody provides', () => {
    const registry = registryOf({ id: 'combat', provides: [], dependencies: ['world.bounds'] });

    expect(() => resolveInstallOrder([{ packId: 'combat' }], { registry, preexisting: [] })).toThrow(
      /"combat".*world\.bounds/s,
    );
  });

  it('reports a dependency cycle rather than looping forever', () => {
    const registry = registryOf(
      { id: 'a', provides: ['cap.a'], dependencies: ['cap.b'] },
      { id: 'b', provides: ['cap.b'], dependencies: ['cap.a'] },
    );

    expect(() =>
      resolveInstallOrder([{ packId: 'a' }, { packId: 'b' }], { registry, preexisting: [] }),
    ).toThrow(/cycle/);
  });

  it('rejects an unregistered pack id and lists what is registered', () => {
    const registry = registryOf({ id: 'world', provides: [], dependencies: [] });

    expect(() => resolveInstallOrder([{ packId: 'wrold' }], { registry, preexisting: [] })).toThrow(
      /"wrold" is not registered.*world/s,
    );
  });

  it('rejects the same pack selected twice', () => {
    const registry = registryOf({ id: 'world', provides: [], dependencies: [] });

    expect(() =>
      resolveInstallOrder([{ packId: 'world' }, { packId: 'world' }], { registry, preexisting: [] }),
    ).toThrow(/more than once/);
  });

  it('rejects two packs claiming the same capability', () => {
    const registry = registryOf(
      { id: 'a', provides: ['world.bounds'], dependencies: [] },
      { id: 'b', provides: ['world.bounds'], dependencies: [] },
    );

    expect(() =>
      resolveInstallOrder([{ packId: 'a' }, { packId: 'b' }], { registry, preexisting: [] }),
    ).toThrow(/provided by both "a" and "b"/);
  });

  it('rejects a pack shadowing a core capability', () => {
    const registry = registryOf({ id: 'a', provides: ['core.input'], dependencies: [] });

    expect(() =>
      resolveInstallOrder([{ packId: 'a' }], { registry, preexisting: ['core.input'] }),
    ).toThrow(/collides with a core capability/);
  });
});
