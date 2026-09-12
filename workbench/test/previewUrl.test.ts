import { describe, expect, it } from 'vitest';
import { parseViteUrl } from '../server/previewManager.ts';

/**
 * The Fast Preview reads the dev server's own announcement. On GitHub
 * Actions `CI=true` makes Vite emit ANSI colour codes with no TTY attached,
 * splitting the port digits with escapes - the announcement was never
 * matched, every image-first creation "was ready to run" but never ran, and
 * WB-IMAGE-001 timed out on CI while passing locally. Pin both shapes.
 */
describe('parseViteUrl', () => {
  it('reads the plain (no-TTY, no-CI) announcement', () => {
    expect(parseViteUrl('\n  VITE v8.2.2  ready in 171 ms\n\n  ➜  Local:   http://127.0.0.1:53706/\n')).toBe('http://127.0.0.1:53706');
  });

  it('reads the coloured announcement Vite prints when CI is set', () => {
    const coloured = '  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://127.0.0.1:\x1b[1m53700\x1b[22m/\x1b[39m\n';
    expect(parseViteUrl(coloured)).toBe('http://127.0.0.1:53700');
  });

  it('ignores chunks that carry no announcement', () => {
    expect(parseViteUrl('  VITE v8.2.2  ready in 528 ms')).toBeNull();
    expect(parseViteUrl('http://example.com:80/')).toBeNull();
  });
});
