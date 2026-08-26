import { defineConfig } from 'vitest/config';

/**
 * Phase 1 unit layer.
 *
 * These tests deliberately run in plain Node with no DOM and no renderer. The
 * logic they cover - lifecycle, action edges, pack resolution, save migration -
 * was designed to be engine-free precisely so it can be tested this way. Browser
 * journeys are a separate, later layer.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/test/**/*.test.ts',
      'starter/test/**/*.test.ts',
      'demos/*/tests/**/*.test.ts',
      'games/*/tests/**/*.test.ts',
    ],
  },
});
