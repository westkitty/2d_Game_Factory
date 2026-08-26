/**
 * The host's security boundary.
 *
 * The browser is being handed local authority over this repository, so this
 * file is where "a page the user did not open must not be able to drive the
 * factory" is enforced. Every rule here is one of the controls listed in
 * docs/architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md section 4.
 *
 * What is deliberately absent matters as much as what is present: there is no
 * generic command endpoint, no arbitrary-path endpoint, no `eval`, no
 * `shell: true`, and no code path that turns caller-supplied text into an
 * executable or an argv position.
 */

import { randomBytes } from 'node:crypto';

export const LIMITS = {
  /** JSON request bodies. Generous for a scene document, far below anything that would matter for memory. */
  jsonBodyBytes: 2 * 1024 * 1024,
  /** One uploaded image. */
  singleUploadBytes: 24 * 1024 * 1024,
  /** One multi-file / folder import request. */
  batchUploadBytes: 96 * 1024 * 1024,
  /** Total expanded size of one ZIP asset pack. */
  zipExpandedBytes: 192 * 1024 * 1024,
  zipEntryBytes: 24 * 1024 * 1024,
  zipEntryCount: 2000,
  /** How many images are decoded/hashed/transformed at once (section 14). */
  importConcurrency: 3,
  displayNameChars: 120,
} as const;

export class SecurityError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SecurityError';
    this.status = status;
  }
}

/** One 32-byte token per host process. Never persisted, never logged, never placed in a URL. */
export function mintSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Constant-time comparison.
 *
 * `crypto.timingSafeEqual` throws on a length mismatch, which would itself
 * leak length, so this compares lengths first and then folds every byte -
 * an early `return false` inside the loop would reintroduce the timing
 * signal this exists to remove.
 */
export function tokensMatch(expected: string, supplied: string | undefined): boolean {
  if (typeof supplied !== 'string' || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * Rejects any request whose `Origin` is not a loopback page.
 *
 * A same-origin `fetch` from the workbench page sends no `Origin` on GET, and
 * sends the workbench's own origin on everything else; a hostile page on the
 * public internet cannot forge either. Requests with no `Origin` are allowed
 * only for safe methods, so a cross-origin form POST (which browsers *do*
 * send an Origin for) can never slip through as "absent".
 */
export function assertAcceptableOrigin(method: string, origin: string | undefined, hostHeader: string | undefined): void {
  const safeMethod = method === 'GET' || method === 'HEAD';
  if (origin === undefined || origin === 'null') {
    if (safeMethod) return;
    throw new SecurityError(403, 'Refused: a state-changing request must carry an Origin header.');
  }
  const originHost = hostOf(origin);
  if (originHost === null || !LOOPBACK_HOSTS.has(originHost)) {
    throw new SecurityError(403, `Refused: origin "${origin}" is not a local workbench page.`);
  }
  if (hostHeader !== undefined) {
    const hostName = hostHeader.replace(/:\d+$/, '');
    if (!LOOPBACK_HOSTS.has(hostName)) {
      throw new SecurityError(403, `Refused: host "${hostHeader}" is not loopback.`);
    }
  }
}

/** Game ids reuse the CLI's slug rule verbatim so the workbench can never create a game the CLI would refuse. */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function assertValidGameId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || !SLUG_PATTERN.test(value)) {
    throw new SecurityError(400, `Invalid game id ${JSON.stringify(value)}: lowercase letters, numbers and hyphens only, starting with a letter.`);
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new SecurityError(400, `Invalid game id ${JSON.stringify(value)}.`);
  }
  return value;
}

const ASSET_ID_PATTERN = /^(src|der)_[a-f0-9]{16}$/;

export function assertValidAssetId(value: unknown): string {
  if (typeof value !== 'string' || !ASSET_ID_PATTERN.test(value)) {
    throw new SecurityError(400, `Invalid asset id ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Reduces a user-supplied filename to something safe to *display* and to use
 * as a suffix. It is never the whole stored path: stored files are
 * content-addressed (`<assetId>.<ext>`), so even a name that survives this
 * unchanged cannot steer a write.
 */
export function normalizeFileName(raw: string): string {
  const withoutDirs = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = withoutDirs
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.\-]+/, '')
    .replace(/-+/g, '-')
    .slice(0, LIMITS.displayNameChars);
  return cleaned.length > 0 ? cleaned : 'asset';
}

/** A relative path kept only for grouping and folder labels - flattened so it can never be joined into a write. */
export function normalizeRelativePath(raw: string): string {
  const parts = raw
    .split(/[\\/]/)
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .map((part) => normalizeFileName(part));
  return parts.slice(-4).join('/');
}

export function assertBodyWithinLimit(byteLength: number, limit: number, what: string): void {
  if (byteLength > limit) {
    throw new SecurityError(413, `${what} is ${byteLength} bytes, over the ${limit}-byte limit.`);
  }
}

const SUPPORTED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function isSupportedImageMime(mime: string): boolean {
  return SUPPORTED_IMAGE_MIMES.has(mime);
}

/** Extension for a supported image mime. Used to build the content-addressed stored filename. */
export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      throw new SecurityError(400, `Unsupported image type "${mime}".`);
  }
}
