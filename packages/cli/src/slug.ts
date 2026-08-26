/**
 * Filesystem-safe id validation.
 *
 * Every id the CLI writes into a path (`game-id`, `level-id`, `theme-id`)
 * goes through this gate first. A slug is lowercase letters, digits and
 * hyphens only - no path separators, no `..`, no leading dot, no absolute
 * path, never empty. Rejecting anything else here is what makes every
 * downstream `path.join` safe without each command re-deriving the same
 * check.
 */

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export class InvalidSlugError extends Error {
  constructor(kind: string, value: string) {
    super(`Invalid ${kind} "${value}": ids may contain lowercase letters, numbers, and hyphens only, and must start with a letter.`);
    this.name = 'InvalidSlugError';
  }
}

/** Throws InvalidSlugError naming the offending id. Never returns a value that still needs checking. */
export function assertValidSlug(kind: string, value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidSlugError(kind, String(value));
  }
  if (!SLUG_PATTERN.test(value)) {
    throw new InvalidSlugError(kind, value);
  }
  // Belt and suspenders beyond the pattern: the pattern already excludes '/',
  // '\\' and '..' (neither character is in the allowed set), but a reviewer
  // should not have to re-derive that from the regex alone.
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new InvalidSlugError(kind, value);
  }
  return value;
}
