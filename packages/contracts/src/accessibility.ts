/**
 * Accessibility state is a live, read-only projection of settings plus device
 * capability. It is orthogonal to theme: a theme may not remove it, and a preset
 * may hide irrelevant rows without deleting the architecture.
 */
export interface AccessibilityState {
  readonly reducedMotion: boolean;
  /** 0..1. Already folded with reducedMotion; systems multiply shake by this. */
  readonly screenShakeScale: number;
  readonly highContrast: boolean;
  /** True when the primary pointer is coarse (touch-first device). */
  readonly coarsePointer: boolean;
  /** Whether on-screen touch controls should be presented. */
  readonly touchControlsVisible: boolean;
  readonly audioEnabled: boolean;
}
