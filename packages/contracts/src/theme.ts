import type { AssetDescriptor } from './content.ts';
import type { UiCopy } from './ui.ts';

/**
 * Theme pack contract.
 *
 * The runtime and every system pack understand semantic asset roles
 * (AssetRole) and semantic UI state; a theme supplies the presentation for
 * those roles. Swapping a theme must never change gameplay data - a theme
 * document carries only assets, UI tokens/copy and font declarations, never
 * tuning, level or system-pack configuration.
 */

/** Small palette of CSS custom-property values a theme may set for DOM UI (touch controls, panels). */
export interface ThemeTokens {
  readonly background: string;
  readonly panel: string;
  readonly panelActive: string;
  readonly text: string;
  readonly accent: string;
  readonly border: string;
}

/** System font stack declarations only - never a remote font URL (MASTER_PROJECT.md section 10). */
export interface ThemeFonts {
  readonly ui: string;
}

export interface ThemeManifest {
  readonly schemaVersion: number;
  readonly id: string;
  readonly displayName: string;
  /** Semantic role -> local asset descriptor. Same shape ContentBundle.assets already carries. */
  readonly assets: readonly AssetDescriptor[];
  readonly tokens: ThemeTokens;
  readonly fonts: ThemeFonts;
  readonly ui?: Partial<UiCopy>;
  /**
   * Optional token overrides applied instead of `tokens` when
   * AccessibilityState.highContrast is true. Absent means the theme has no
   * dedicated high-contrast projection and `tokens` is used unchanged.
   */
  readonly highContrastTokens?: Partial<ThemeTokens>;
}
