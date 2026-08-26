import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  LIMITS,
  SecurityError,
  assertAcceptableOrigin,
  assertBodyWithinLimit,
  assertValidAssetId,
  assertValidGameId,
  extensionForMime,
  isSupportedImageMime,
  mintSessionToken,
  normalizeFileName,
  normalizeRelativePath,
  tokensMatch,
} from '../server/security.ts';
import { PathContainmentError, REPO_ROOT, derivedAssetUrl, resolveContained } from '../server/paths.ts';
import { sniffImage, UnsupportedImageError } from '../server/imageMeta.ts';
import { encodePng } from '../server/png.ts';
import { createRaster } from '../shared/image/raster.ts';

describe('session token', () => {
  it('mints a distinct 64-hex-character token per call', () => {
    const a = mintSessionToken();
    const b = mintSessionToken();
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });

  it('matches only the exact token', () => {
    const token = mintSessionToken();
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token, undefined)).toBe(false);
    expect(tokensMatch(token, '')).toBe(false);
    expect(tokensMatch(token, token.slice(0, -1) + '0')).toBe(false);
    expect(tokensMatch(token, token + 'a')).toBe(false);
  });
});

describe('origin policy', () => {
  it('accepts a loopback origin', () => {
    expect(() => assertAcceptableOrigin('POST', 'http://127.0.0.1:5199', '127.0.0.1:5199')).not.toThrow();
    expect(() => assertAcceptableOrigin('POST', 'http://localhost:5199', 'localhost:5199')).not.toThrow();
  });

  it('rejects any remote origin', () => {
    expect(() => assertAcceptableOrigin('POST', 'https://evil.example', '127.0.0.1:5199')).toThrow(SecurityError);
    expect(() => assertAcceptableOrigin('POST', 'http://127.0.0.1.evil.example', '127.0.0.1:5199')).toThrow(SecurityError);
    expect(() => assertAcceptableOrigin('POST', 'null', '127.0.0.1:5199')).toThrow(SecurityError);
  });

  it('allows a missing Origin only for safe methods', () => {
    expect(() => assertAcceptableOrigin('GET', undefined, '127.0.0.1:5199')).not.toThrow();
    expect(() => assertAcceptableOrigin('POST', undefined, '127.0.0.1:5199')).toThrow(SecurityError);
    expect(() => assertAcceptableOrigin('DELETE', undefined, '127.0.0.1:5199')).toThrow(SecurityError);
  });

  it('rejects a non-loopback Host even when the Origin looks local', () => {
    expect(() => assertAcceptableOrigin('POST', 'http://127.0.0.1:5199', 'factory.example.com')).toThrow(SecurityError);
  });
});

describe('identifier validation', () => {
  it('accepts the same slugs the CLI accepts', () => {
    expect(assertValidGameId('my-game')).toBe('my-game');
    expect(assertValidGameId('a')).toBe('a');
  });

  it('rejects traversal, separators, leading digits and empties', () => {
    for (const bad of ['../escape', 'a/b', 'a\\b', '..', '', '1game', 'Game', 'game_id', 'a'.repeat(65), null, 42]) {
      expect(() => assertValidGameId(bad as unknown)).toThrow(SecurityError);
    }
  });

  it('accepts only well-formed asset ids', () => {
    expect(assertValidAssetId('src_0123456789abcdef')).toBe('src_0123456789abcdef');
    expect(assertValidAssetId('der_fedcba9876543210')).toBe('der_fedcba9876543210');
    for (const bad of ['src_short', 'xyz_0123456789abcdef', 'src_0123456789ABCDEF', '../x', '']) {
      expect(() => assertValidAssetId(bad)).toThrow(SecurityError);
    }
  });
});

describe('filename normalization', () => {
  it('flattens a hostile name to something that cannot steer a write', () => {
    expect(normalizeFileName('../../etc/passwd')).toBe('passwd');
    expect(normalizeFileName('..\\..\\windows\\system32')).toBe('system32');
    expect(normalizeFileName('.hidden')).toBe('hidden');
    expect(normalizeFileName('My Hero (final)!.PNG')).toBe('my-hero-final-.png');
  });

  it('never returns an empty name', () => {
    expect(normalizeFileName('')).toBe('asset');
    expect(normalizeFileName('///')).toBe('asset');
    expect(normalizeFileName('...')).toBe('asset');
  });

  it('caps length', () => {
    expect(normalizeFileName('a'.repeat(500)).length).toBeLessThanOrEqual(LIMITS.displayNameChars);
  });

  it('keeps a relative path usable as a folder label while removing every traversal segment', () => {
    expect(normalizeRelativePath('art/hero/walk_01.png')).toBe('art/hero/walk_01.png');
    expect(normalizeRelativePath('../../../art/hero.png')).toBe('art/hero.png');
    expect(normalizeRelativePath('a/b/c/d/e/f/g.png')).toBe('d/e/f/g.png');
  });
});

describe('path containment', () => {
  it('resolves inside the root', () => {
    const resolved = resolveContained(REPO_ROOT, 'games', 'demo');
    expect(resolved).toBe(path.join(REPO_ROOT, 'games', 'demo'));
  });

  it('refuses to escape via traversal or an absolute segment', () => {
    expect(() => resolveContained(REPO_ROOT, '..', 'elsewhere')).toThrow(PathContainmentError);
    expect(() => resolveContained(REPO_ROOT, '/etc/passwd')).toThrow(PathContainmentError);
    expect(() => resolveContained(REPO_ROOT, 'games', '..', '..', 'outside')).toThrow(PathContainmentError);
  });

  it('does not treat a sibling with a shared prefix as contained', () => {
    const root = path.join(REPO_ROOT, 'games', 'a');
    expect(() => resolveContained(root, '..', 'abc')).toThrow(PathContainmentError);
  });

  it('builds a relative, same-origin runtime URL for a derived asset', () => {
    expect(derivedAssetUrl('der_0123456789abcdef.png')).toBe('assets/workbench/der_0123456789abcdef.png');
    expect(derivedAssetUrl('x.png').startsWith('/')).toBe(false);
    expect(derivedAssetUrl('x.png')).not.toMatch(/^https?:/);
  });
});

describe('body limits', () => {
  it('accepts up to the limit and refuses past it with a 413', () => {
    expect(() => assertBodyWithinLimit(10, 10, 'Body')).not.toThrow();
    try {
      assertBodyWithinLimit(11, 10, 'Body');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      expect((error as SecurityError).status).toBe(413);
    }
  });

  it('caps import concurrency well below anything that would load a whole pack at once', () => {
    expect(LIMITS.importConcurrency).toBeGreaterThan(0);
    expect(LIMITS.importConcurrency).toBeLessThanOrEqual(4);
  });
});

describe('image sniffing', () => {
  it('trusts the bytes, not the declared type', () => {
    const png = encodePng(createRaster(13, 7));
    expect(sniffImage(png)).toEqual({ mime: 'image/png', width: 13, height: 7 });
  });

  it('reads JPEG dimensions from the frame header, skipping segments by length', () => {
    // SOI, an APP0 segment long enough to contain a decoy 0xFFC0, then SOF0 8x4.
    const app0 = [0xff, 0xe0, 0x00, 0x08, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00];
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x04, 0x00, 0x08, 0x03];
    const bytes = Uint8Array.from([0xff, 0xd8, ...app0, ...sof0]);
    expect(sniffImage(bytes)).toEqual({ mime: 'image/jpeg', width: 8, height: 4 });
  });

  it('reads lossless WebP dimensions', () => {
    const bytes = new Uint8Array(40);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
    // 14 bits width-1 then 14 bits height-1: 32x16.
    new DataView(bytes.buffer).setUint32(21, (31 & 0x3fff) | ((15 & 0x3fff) << 14), true);
    expect(sniffImage(bytes)).toEqual({ mime: 'image/webp', width: 32, height: 16 });
  });

  it('recognises GIF so the inbox can explain why it is unsupported', () => {
    const bytes = new Uint8Array(16);
    bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    new DataView(bytes.buffer).setUint16(6, 20, true);
    new DataView(bytes.buffer).setUint16(8, 10, true);
    expect(sniffImage(bytes).mime).toBe('image/gif');
    expect(isSupportedImageMime('image/gif')).toBe(false);
  });

  it('names the supported set and their extensions', () => {
    expect(isSupportedImageMime('image/png')).toBe(true);
    expect(isSupportedImageMime('image/jpeg')).toBe(true);
    expect(isSupportedImageMime('image/webp')).toBe(true);
    expect(isSupportedImageMime('application/zip')).toBe(false);
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(() => extensionForMime('image/gif')).toThrow(SecurityError);
  });

  it('refuses an unrecognised file with the bytes it actually saw', () => {
    expect(() => sniffImage(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(UnsupportedImageError);
    expect(() => sniffImage(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/01 02 03/);
  });
});
