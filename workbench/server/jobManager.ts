/**
 * The job/activity model (section 26).
 *
 * Long operations get visible state - queued, running, a step label, progress
 * when it is genuinely knowable, and concise log lines. Progress is `null`
 * rather than a fabricated fraction when the step count is unknown: a
 * progress bar that lies is worse than no progress bar.
 */

import { randomUUID } from 'node:crypto';
import type { JobKind, JobLogLine, JobStatus, JobView } from '../shared/types.ts';

const MAX_LOG_LINES = 200;
const MAX_RETAINED_JOBS = 60;

export class JobCancelledError extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'JobCancelledError';
  }
}

export interface JobHandle {
  readonly id: string;
  /** Throws JobCancelledError when the user has asked to stop. Safe operations poll this between units of work. */
  throwIfCancelled(): void;
  cancelled(): boolean;
  setStep(step: string): void;
  setProgress(progress: number | null): void;
  log(text: string): void;
}

interface JobRecord {
  id: string;
  kind: JobKind;
  label: string;
  status: JobStatus;
  step: string;
  progress: number | null;
  cancellable: boolean;
  log: JobLogLine[];
  cancelRequested: boolean;
  result?: unknown;
  error?: string;
  startedOrder: number;
}

export class JobManager {
  readonly #jobs = new Map<string, JobRecord>();
  #order = 0;

  /**
   * Runs `work` as a tracked job. Never rejects: a failure becomes a `failed`
   * job with its message, because the caller is an HTTP handler that has
   * already returned the job id and the UI reads the outcome from job state.
   */
  run<T>(kind: JobKind, label: string, cancellable: boolean, work: (handle: JobHandle) => Promise<T>): string {
    const id = randomUUID();
    const record: JobRecord = {
      id,
      kind,
      label,
      status: 'queued',
      step: 'Queued',
      progress: null,
      cancellable,
      log: [],
      cancelRequested: false,
      startedOrder: this.#order++,
    };
    this.#jobs.set(id, record);
    this.#prune();

    const handle: JobHandle = {
      id,
      cancelled: () => record.cancelRequested,
      throwIfCancelled: () => {
        if (record.cancelRequested) throw new JobCancelledError();
      },
      setStep: (step) => {
        record.step = step;
        this.#append(record, step);
      },
      setProgress: (progress) => {
        record.progress = progress === null ? null : Math.max(0, Math.min(1, progress));
      },
      log: (text) => this.#append(record, text),
    };

    // Deliberately not awaited: `run` hands back an id immediately so the HTTP
    // response never blocks on the work itself.
    void (async () => {
      record.status = 'running';
      record.step = 'Starting';
      try {
        const result = await work(handle);
        if (record.cancelRequested) {
          record.status = 'cancelled';
          record.step = 'Cancelled';
        } else {
          record.status = 'completed';
          record.step = 'Done';
          record.progress = 1;
          record.result = result;
        }
      } catch (error) {
        if (error instanceof JobCancelledError || record.cancelRequested) {
          record.status = 'cancelled';
          record.step = 'Cancelled';
        } else {
          record.status = 'failed';
          record.step = 'Failed';
          record.error = error instanceof Error ? error.message : String(error);
          this.#append(record, record.error);
        }
      }
    })();

    return id;
  }

  get(id: string): JobView | undefined {
    const record = this.#jobs.get(id);
    return record ? toView(record) : undefined;
  }

  list(): readonly JobView[] {
    return [...this.#jobs.values()].sort((a, b) => b.startedOrder - a.startedOrder).map(toView);
  }

  /** Returns false when the job is unknown, already finished, or not cancellable - never pretends to have stopped something. */
  cancel(id: string): boolean {
    const record = this.#jobs.get(id);
    if (!record) return false;
    if (!record.cancellable) return false;
    if (record.status !== 'queued' && record.status !== 'running') return false;
    record.cancelRequested = true;
    this.#append(record, 'Cancellation requested.');
    return true;
  }

  #append(record: JobRecord, text: string): void {
    record.log.push({ seq: record.log.length, text });
    if (record.log.length > MAX_LOG_LINES) record.log.splice(0, record.log.length - MAX_LOG_LINES);
  }

  #prune(): void {
    if (this.#jobs.size <= MAX_RETAINED_JOBS) return;
    const finished = [...this.#jobs.values()]
      .filter((job) => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')
      .sort((a, b) => a.startedOrder - b.startedOrder);
    for (const job of finished) {
      if (this.#jobs.size <= MAX_RETAINED_JOBS) break;
      this.#jobs.delete(job.id);
    }
  }
}

function toView(record: JobRecord): JobView {
  return {
    id: record.id,
    kind: record.kind,
    label: record.label,
    status: record.status,
    step: record.step,
    progress: record.progress,
    cancellable: record.cancellable && (record.status === 'queued' || record.status === 'running'),
    log: [...record.log],
    ...(record.result !== undefined ? { result: record.result } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
  };
}

/**
 * Runs `items` through `worker` with at most `limit` in flight (section 14's
 * bounded-concurrency requirement). Results keep input order; the first
 * rejection propagates once the in-flight work settles.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const bound = Math.max(1, Math.trunc(limit));
  const results = new Array<R>(items.length);
  let next = 0;
  let peak = 0;
  let inFlight = 0;

  async function pump(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      inFlight += 1;
      if (inFlight > peak) peak = inFlight;
      try {
        results[index] = await worker(items[index]!, index);
      } finally {
        inFlight -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(bound, items.length) }, () => pump()));
  lastObservedPeak = peak;
  return results;
}

/**
 * The highest number of concurrent workers the last `mapWithConcurrency` call
 * actually reached. Exists so a test can assert the cap is real rather than
 * asserting that the code merely contains a limit constant.
 */
export let lastObservedPeak = 0;
