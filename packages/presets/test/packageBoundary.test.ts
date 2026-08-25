import { describe, expect, it } from 'vitest';
import presetsPkg from '../package.json';
import packsPkg from '../../packs/package.json';
import runtimePkg from '../../runtime/package.json';
// `?raw` (a Vite feature Vitest shares) imports file content as a plain string,
// so this file can inspect real source without a Node fs/path dependency this
// package's own tsconfig has no @types/node coverage for.
import idsSource from '../../packs/src/ids.ts?raw';
import resolveInstallOrderSource from '../../runtime/src/core/resolveInstallOrder.ts?raw';

/**
 * The Phase 5 deferred trigger (ADR-0010/ADR-0013's "exporting pack config
 * schemas as data instead of self-registering" - deferred with the trigger
 * "a CLI or preset barrel needs pack metadata in Node without Ajv on the
 * dependency path") fired twice in Phase 7A: once for pack identity
 * (`@sw2d/packs`' barrel triggers Ajv registration via progressionPack/
 * arcadePack) and once for pack *composition* (`@sw2d/runtime`'s barrel
 * loads Phaser merely to reach the pure `resolveInstallOrder`). This file
 * proves both repairs declaratively, against the actual package.json files
 * and source text, rather than by inspecting a loaded module graph - see
 * docs/architecture/adr/0015-preset-catalog-and-pack-metadata-boundary.md.
 */

describe('@sw2d/presets production dependency shape', () => {
  it('depends on @sw2d/contracts and @sw2d/packs only (no Ajv, no Phaser)', () => {
    expect(Object.keys(presetsPkg.dependencies).sort()).toEqual(['@sw2d/contracts', '@sw2d/packs']);
  });

  it('keeps @sw2d/schemas and @sw2d/runtime as devDependencies, not production dependencies', () => {
    expect(Object.keys(presetsPkg.devDependencies).sort()).toEqual(['@sw2d/runtime', '@sw2d/schemas']);
  });
});

describe('@sw2d/runtime exposes a Phaser-free composition subpath', () => {
  it('declares the ./composition export, pointing at resolveInstallOrder directly', () => {
    expect(runtimePkg.exports['./composition'].default).toBe('./src/core/resolveInstallOrder.ts');
  });

  it('resolveInstallOrder.ts imports only @sw2d/contracts types - no Phaser', () => {
    expect(resolveInstallOrderSource).not.toMatch(/from ['"]phaser['"]/);
  });
});

describe('@sw2d/packs exposes a side-effect-free ids subpath', () => {
  it('declares the ./ids export', () => {
    expect(packsPkg.exports['./ids']).toBeDefined();
  });

  it('ids.ts itself has zero imports - the property that makes the subpath side-effect-free', () => {
    expect(idsSource).not.toMatch(/^import /m);
  });
});
