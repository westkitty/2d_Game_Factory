import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTheme } from '../server/themeSynthesis.ts';
import { GAMES_ROOT } from '../server/paths.ts';
import type { AssetsDocument, BlueprintDocument } from '../shared/types.ts';

/**
 * Theme synthesis must not clobber what other writers own (Arena finish
 * program, adversarial sweep B).
 *
 * theme.json has three writers: the generator (which emits the game's `ui`
 * copy block), a starter kit's overlay (which may add supplemental generated
 * UI assets like ui.panel that its shell pack resolves at install time), and
 * workbench synthesis. Synthesis used to rebuild the document from scratch,
 * so importing a single sprite into an expanded-kit game deleted ui.panel -
 * the game then crashed at boot with UnknownAssetRoleError - and reverted
 * the genre HUD copy. Found by the WB-IMAGE-001 real-browser journey; these
 * tests keep it fixed.
 */

const GAME_ID = 'theme-preservation-test-game';
const THEME_DIR = `${GAMES_ROOT}/${GAME_ID}/content/themes/default`;

const NO_ASSETS: AssetsDocument = { version: 1, assets: [] };
const EMPTY_BLUEPRINT: BlueprintDocument = { version: 1, roleAssignments: [], palette: [] };

function writeThemeOnDisk(theme: Record<string, unknown>): void {
  mkdirSync(THEME_DIR, { recursive: true });
  writeFileSync(`${THEME_DIR}/theme.json`, JSON.stringify(theme, null, 2));
}

afterEach(() => {
  rmSync(`${GAMES_ROOT}/${GAME_ID}`, { recursive: true, force: true });
});

describe('theme synthesis preserves the surfaces other writers own', () => {
  it('carries the ui copy block forward verbatim', () => {
    writeThemeOnDisk({
      schemaVersion: 1,
      id: 'default',
      displayName: 'Default',
      ui: { title: 'PROBE GAME', subtitle: 'Bullet Hell', playHint: 'MOVE WASD/ARROWS  -  FIRE J/X' },
      assets: [],
      tokens: {},
    });
    const result = buildTheme({ gameId: GAME_ID, assets: NO_ASSETS, blueprint: EMPTY_BLUEPRINT });
    expect(result.theme.ui).toEqual({ title: 'PROBE GAME', subtitle: 'Bullet Hell', playHint: 'MOVE WASD/ARROWS  -  FIRE J/X' });
  });

  it('keeps a starter kit\'s supplemental generated roles (ui.panel) that synthesis does not emit', () => {
    writeThemeOnDisk({
      schemaVersion: 1,
      id: 'default',
      displayName: 'Default',
      assets: [
        { role: 'ui.panel', key: 'theme/default/ui.panel', spec: { kind: 'generated', width: 320, height: 56, fill: '#1a1f2b' } },
        // A stale player entry must NOT survive: synthesis emits its own.
        { role: 'player', key: 'stale/player', spec: { kind: 'generated', width: 1, height: 1, fill: '#000000' } },
      ],
      tokens: {},
    });
    const result = buildTheme({ gameId: GAME_ID, assets: NO_ASSETS, blueprint: EMPTY_BLUEPRINT });
    const roles = result.theme.assets.map((asset) => asset.role);
    expect(roles).toContain('ui.panel');
    const playerEntries = result.theme.assets.filter((asset) => asset.role === 'player');
    expect(playerEntries.length).toBe(1);
    expect(playerEntries[0]!.key).not.toBe('stale/player');
  });

  it('never carries forward an image-spec entry it did not emit (shipping bytes need provenance)', () => {
    writeThemeOnDisk({
      schemaVersion: 1,
      id: 'default',
      displayName: 'Default',
      assets: [{ role: 'background', key: 'old/bg', spec: { kind: 'image', url: 'assets/workbench/old-bg.png' } }],
      tokens: {},
    });
    const result = buildTheme({ gameId: GAME_ID, assets: NO_ASSETS, blueprint: EMPTY_BLUEPRINT });
    expect(result.theme.assets.some((asset) => asset.key === 'old/bg')).toBe(false);
  });

  it('stands alone when no theme exists on disk yet', () => {
    const result = buildTheme({ gameId: GAME_ID, assets: NO_ASSETS, blueprint: EMPTY_BLUEPRINT });
    expect(result.theme.ui).toBeUndefined();
    expect(result.theme.assets.length).toBeGreaterThan(0);
  });
});
