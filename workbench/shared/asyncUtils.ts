/**
 * Generic async utilities for the workbench.
 *
 * Debounce, throttle, and request deduplication - the three patterns that
 * prevent the workbench from hammering the API on every keystroke or click.
 */

/**
 * Creates a debounced version of a function.
 *
 * The returned function delays invoking `fn` until `delayMs` milliseconds
 * have elapsed since the last invocation. If called again within that window,
 * the timer resets.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  }) as T & { cancel(): void };
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/**
 * Creates a throttled version of a function.
 *
 * The returned function invokes `fn` at most once per `intervalMs` milliseconds.
 * Subsequent calls within the interval are dropped (not queued).
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  intervalMs: number,
): T {
  let lastCall = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

/**
 * Deduplicates concurrent async requests with the same key.
 *
 * If a request with the same key is already in flight, returns the existing
 * promise instead of starting a new request. Once the request completes
 * (success or failure), the key is cleared and a new request can start.
 */
export function createRequestDeduplicator(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const inFlight = new Map<string, Promise<unknown>>();

  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
  };
}

/**
 * Creates a retry wrapper for async functions.
 *
 * Retries the function up to `maxRetries` times with exponential backoff
 * before giving up. Useful for network requests that may fail transiently.
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100,
): Promise<T> {
  return (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError;
  })();
}
