/**
 * Promotion gate for post-proof rich starter kits.
 *
 * Sonnet adds a kit here only after its focused tests and real generated-game
 * browser proof pass. Keeping this array empty initially means scaffolding can
 * land without changing current user-visible starter-kit behavior.
 */
import type { StarterKit } from '../contracts.ts';

export const EXPANDED_STARTER_KITS: readonly StarterKit[] = Object.freeze([]);
