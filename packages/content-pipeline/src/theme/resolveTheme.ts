import type { AccessibilityState, AssetDescriptor, RoleAnimationDescriptor, ThemeManifest, ThemeTokens, UiCopy } from '@sw2d/contracts';

/**
 * Theme resolution: fold a validated ThemeManifest plus the current
 * accessibility projection into what the game actually presents. Gameplay
 * data never enters or leaves this function - only assets, presentation
 * animations, UI tokens and UI copy - which is the mechanical guarantee
 * behind "theme changes do not change gameplay" (MASTER_PROJECT.md section 9/12).
 */
export interface ResolvedTheme {
  readonly assets: readonly AssetDescriptor[];
  readonly animations?: readonly RoleAnimationDescriptor[];
  readonly ui?: Partial<UiCopy>;
  readonly tokens: ThemeTokens;
}

/**
 * `highContrast` swaps in the theme's `highContrastTokens` overrides (falling
 * back to the base token for anything the override omits) - the bounded,
 * real accessibility/theme integration MASTER_PROJECT.md section 12 asks
 * for. A theme with no `highContrastTokens` is unaffected: `tokens` is
 * returned unchanged.
 */
export function resolveTheme(theme: ThemeManifest, accessibility: Pick<AccessibilityState, 'highContrast'>): ResolvedTheme {
  const tokens: ThemeTokens =
    accessibility.highContrast && theme.highContrastTokens
      ? { ...theme.tokens, ...theme.highContrastTokens }
      : theme.tokens;

  return {
    assets: theme.assets,
    ...(theme.animations !== undefined ? { animations: theme.animations } : {}),
    ...(theme.ui !== undefined ? { ui: theme.ui } : {}),
    tokens,
  };
}
