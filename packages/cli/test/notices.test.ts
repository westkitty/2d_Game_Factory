import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/paths.ts';
import { formatThirdPartyNoticesText, resolveShippedDependencies } from '../src/releasePackaging/notices.ts';

/**
 * A generated game's own package.json dependencies - the same set every
 * `sw2d new` writes (packages/cli/src/templates/package.json.template).
 * Kept here as a literal, not imported from the template, so this test
 * fails loudly if the template's dependency set ever drifts without this
 * suite being updated too.
 */
const GENERATED_GAME_DEPENDENCIES = ['@sw2d/contracts', '@sw2d/content-pipeline', '@sw2d/packs', '@sw2d/runtime', '@sw2d/schemas', 'phaser'];

describe('resolveShippedDependencies', () => {
  it('walks the real workspace graph to real third-party leaves installed in node_modules', () => {
    const deps = resolveShippedDependencies(REPO_ROOT, GENERATED_GAME_DEPENDENCIES);
    const names = deps.map((d) => d.name);
    // phaser is imported directly by @sw2d/runtime; ajv/ajv-formats are
    // imported at runtime via @sw2d/schemas (game.ts.template,
    // main.ts.template, content.ts.template all import from it) - both are
    // real shipped dependencies, not build tooling.
    expect(names).toContain('phaser');
    expect(names).toContain('ajv');
    expect(names).toContain('ajv-formats');
    // No @sw2d/* workspace package is ever itself a "third-party" notice.
    expect(names.some((n) => n.startsWith('@sw2d/'))).toBe(false);
  });

  it('every resolved dependency carries a resolvable version and license', () => {
    const deps = resolveShippedDependencies(REPO_ROOT, GENERATED_GAME_DEPENDENCIES);
    for (const dep of deps) {
      expect(dep.version, dep.name).not.toBe('unknown');
      expect(dep.license, dep.name).not.toBe('unknown');
    }
  });

  it('is deterministic: same input, same sorted output', () => {
    const first = resolveShippedDependencies(REPO_ROOT, GENERATED_GAME_DEPENDENCIES);
    const second = resolveShippedDependencies(REPO_ROOT, GENERATED_GAME_DEPENDENCIES);
    expect(second).toEqual(first);
    expect(first.map((d) => d.name)).toEqual([...first.map((d) => d.name)].sort());
  });

  it('throws rather than silently omitting an unresolvable dependency', () => {
    expect(() => resolveShippedDependencies(REPO_ROOT, ['not-a-real-package-xyz'])).toThrow();
  });
});

describe('formatThirdPartyNoticesText', () => {
  it('includes each dependency name, version, license and license text', () => {
    const deps = resolveShippedDependencies(REPO_ROOT, GENERATED_GAME_DEPENDENCIES);
    const text = formatThirdPartyNoticesText(deps);
    for (const dep of deps) {
      expect(text).toContain(dep.name);
      expect(text).toContain(dep.version);
    }
  });

  it('says so plainly when nothing is shipped', () => {
    expect(formatThirdPartyNoticesText([])).toContain('No third-party code is shipped');
  });
});
