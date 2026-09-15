/**
 * Tests for async utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle, createRequestDeduplicator, withRetry } from '../shared/asyncUtils.ts';

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('delays invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a', 'b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('cancel stops pending invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  it('invokes immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('drops calls within interval', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    const start = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(start);
    throttled();
    vi.spyOn(Date, 'now').mockReturnValue(start + 50);
    throttled();
    vi.spyOn(Date, 'now').mockReturnValue(start + 80);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe('createRequestDeduplicator', () => {
  it('returns same promise for concurrent calls with same key', async () => {
    const dedupe = createRequestDeduplicator();
    let resolve: (value: string) => void;
    const promise = new Promise<string>((r) => { resolve = r; });
    const fn = () => promise;

    const p1 = dedupe('key', fn);
    const p2 = dedupe('key', fn);

    expect(p1).toBe(p2);
    resolve!('result');
    expect(await p1).toBe('result');
  });

  it('allows new request after completion', async () => {
    const dedupe = createRequestDeduplicator();
    const fn1 = vi.fn().mockResolvedValue('first');
    const fn2 = vi.fn().mockResolvedValue('second');

    const r1 = await dedupe('key', fn1);
    expect(r1).toBe('first');

    const r2 = await dedupe('key', fn2);
    expect(r2).toBe('second');
  });

  it('clears key on failure', async () => {
    const dedupe = createRequestDeduplicator();
    const fn1 = vi.fn().mockRejectedValue(new Error('fail'));
    const fn2 = vi.fn().mockResolvedValue('success');

    await expect(dedupe('key', fn1)).rejects.toThrow('fail');
    const r2 = await dedupe('key', fn2);
    expect(r2).toBe('success');
  });
});

describe('withRetry', () => {
  it('returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
