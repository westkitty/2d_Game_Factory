/**
 * Bounds for authoring-time provider networking. Separate file so tests and
 * the net layer share one source of truth.
 */

/** One pack download. Well above any curated Kenney pack, well below memory pressure. */
export const MAX_PACK_DOWNLOAD_BYTES = 64 * 1024 * 1024;

/** One cached remote thumbnail. */
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

export const PACK_DOWNLOAD_TIMEOUT_MS = 30_000;
export const THUMBNAIL_TIMEOUT_MS = 10_000;
