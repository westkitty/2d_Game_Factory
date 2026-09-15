/**
 * Tests for formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatNumber,
  formatRelativeTime,
  formatPercentage,
  truncate,
  pluralize,
  formatCount,
  formatFileSize,
  formatProgressBar,
} from '../shared/formatUtils.ts';

describe('formatDuration', () => {
  it('formats sub-second as < 1s', () => {
    expect(formatDuration(500)).toBe('< 1s');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(30000)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(150000)).toBe('2m 30s');
    expect(formatDuration(60000)).toBe('1m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3900000)).toBe('1h 5m');
    expect(formatDuration(3600000)).toBe('1h');
  });
});

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats large numbers with commas', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('formatRelativeTime', () => {
  it('formats just now', () => {
    expect(formatRelativeTime(Date.now() - 30000)).toBe('just now');
  });

  it('formats minutes ago', () => {
    expect(formatRelativeTime(Date.now() - 120000)).toBe('2 minutes ago');
    expect(formatRelativeTime(Date.now() - 60000)).toBe('1 minute ago');
  });

  it('formats hours ago', () => {
    expect(formatRelativeTime(Date.now() - 7200000)).toBe('2 hours ago');
  });

  it('formats days ago', () => {
    expect(formatRelativeTime(Date.now() - 172800000)).toBe('2 days ago');
  });
});

describe('formatPercentage', () => {
  it('formats with no decimals', () => {
    expect(formatPercentage(75)).toBe('75%');
  });

  it('formats with decimals', () => {
    expect(formatPercentage(75.5, 1)).toBe('75.5%');
  });
});

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
  });
});

describe('pluralize', () => {
  it('returns singular for 1', () => {
    expect(pluralize(1, 'item')).toBe('item');
  });

  it('returns plural for other counts', () => {
    expect(pluralize(0, 'item')).toBe('items');
    expect(pluralize(5, 'item')).toBe('items');
  });

  it('uses custom plural', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children');
  });
});

describe('formatCount', () => {
  it('formats count with label', () => {
    expect(formatCount(1, 'asset')).toBe('1 asset');
    expect(formatCount(5, 'asset')).toBe('5 assets');
    expect(formatCount(1234, 'file')).toBe('1,234 files');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });
});

describe('formatProgressBar', () => {
  it('formats empty progress', () => {
    const bar = formatProgressBar(0, 10, 10);
    expect(bar).toBe('░'.repeat(10));
  });

  it('formats full progress', () => {
    const bar = formatProgressBar(10, 10, 10);
    expect(bar).toBe('█'.repeat(10));
  });

  it('formats partial progress', () => {
    const bar = formatProgressBar(5, 10, 10);
    expect(bar).toBe('█'.repeat(5) + '░'.repeat(5));
  });
});
