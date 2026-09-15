/**
 * Formatting utilities for the workbench and CLI.
 *
 * Pure functions for formatting numbers, durations, dates, and file sizes
 * in a human-readable way. No locale dependencies.
 */

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * Examples: "2m 30s", "1h 5m", "30s", "< 1s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Formats a number with thousands separators.
 *
 * Examples: "1,234", "1,234,567"
 */
export function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  return n.toLocaleString('en-US');
}

/**
 * Formats a relative time (e.g., "2 minutes ago", "3 hours ago").
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < 2592000000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  const months = Math.floor(diff / 2592000000);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/**
 * Formats a percentage (0-100) with optional decimal places.
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncates a string to a maximum length with an ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Pluralizes a word based on count.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}

/**
 * Formats a count with its label (e.g., "5 assets", "1 asset").
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${formatNumber(count)} ${pluralize(count, singular, plural)}`;
}

/**
 * Formats a keyboard shortcut for display.
 */
export function formatKeys(keys: readonly string[]): string {
  return keys.join('+');
}

/**
 * Formats a file size in bytes to a human-readable string.
 * (Re-exported from dom.ts for use in non-DOM contexts)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Formats a progress bar as a string (for CLI output).
 */
export function formatProgressBar(current: number, total: number, width = 20): string {
  if (total <= 0) return '░'.repeat(width);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
