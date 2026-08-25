import { describe, expect, it } from 'vitest';
import type { ThemeManifest } from '@sw2d/contracts';
import { resolveTheme } from '../../src/index.ts';

function theme(overrides: Partial<ThemeManifest> = {}): ThemeManifest {
  return {
    schemaVersion: 1,
    id: 'default',
    displayName: 'Default',
    assets: [{ role: 'player', key: 'default/player', spec: { kind: 'generated', width: 10, height: 10, fill: '#fff' } }],
    tokens: { background: '#000', panel: '#111', panelActive: '#222', text: '#fff', accent: '#0f0', border: '#333' },
    fonts: { ui: 'ui-monospace, monospace' },
    ...overrides,
  };
}

describe('resolveTheme', () => {
  it('returns the base tokens when accessibility.highContrast is false', () => {
    const resolved = resolveTheme(theme(), { highContrast: false });
    expect(resolved.tokens).toEqual(theme().tokens);
  });

  it('returns the base tokens unchanged when highContrast is true but the theme has no override', () => {
    const resolved = resolveTheme(theme(), { highContrast: true });
    expect(resolved.tokens).toEqual(theme().tokens);
  });

  it('merges highContrastTokens over the base tokens when highContrast is true', () => {
    const withOverride = theme({ highContrastTokens: { text: '#ffffff', accent: '#ffff00' } });
    const resolved = resolveTheme(withOverride, { highContrast: true });
    expect(resolved.tokens).toEqual({
      background: '#000',
      panel: '#111',
      panelActive: '#222',
      text: '#ffffff',
      accent: '#ffff00',
      border: '#333',
    });
  });

  it('does not apply highContrastTokens when highContrast is false, even if declared', () => {
    const withOverride = theme({ highContrastTokens: { text: '#ffffff' } });
    const resolved = resolveTheme(withOverride, { highContrast: false });
    expect(resolved.tokens.text).toBe('#fff');
  });

  it('passes assets through unchanged - theme resolution never touches gameplay data', () => {
    const t = theme();
    const resolved = resolveTheme(t, { highContrast: false });
    expect(resolved.assets).toBe(t.assets);
  });

  it('omits ui when the theme declares no copy override', () => {
    const resolved = resolveTheme(theme(), { highContrast: false });
    expect('ui' in resolved).toBe(false);
  });

  it('carries through ui copy overrides when the theme declares them', () => {
    const withUi = theme({ ui: { title: 'HIGH CONTRAST DEMO' } });
    const resolved = resolveTheme(withUi, { highContrast: false });
    expect(resolved.ui).toEqual({ title: 'HIGH CONTRAST DEMO' });
  });
});
