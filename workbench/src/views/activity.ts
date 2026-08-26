/**
 * The Activity panel (section 26).
 *
 * Every long operation is a job with visible state. Progress is a bar only
 * when the number is real; otherwise the step label carries the meaning,
 * because a progress bar that invents a percentage is worse than none.
 *
 * Logs are here and readable, but they are not the primary interface - the
 * step label is. Dumping raw subprocess output at the user is what the
 * terminal already does.
 */

import { el, button, replace } from '../dom.ts';
import { getState, subscribe, update, type AppState } from '../state.ts';
import { cancelJob } from '../actions.ts';
import type { JobView } from '../../shared/types.ts';

const STATUS_LABEL: Readonly<Record<JobView['status'], string>> = {
  queued: 'queued',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  cancelled: 'cancelled',
};

function jobRow(job: JobView): HTMLElement {
  const outcome = job.result as { steps?: readonly { name: string; ok: boolean; detail: readonly string[] }[] } | undefined;

  return el(
    'div',
    { class: `job${job.status === 'failed' ? ' job--failed' : ''}` },
    el(
      'div',
      { class: 'job__head' },
      el('strong', { class: 'truncate', text: job.label }),
      el('span', { class: 'grow faint', style: { 'font-size': '11px' }, text: job.step }),
      el('span', { class: 'badge', text: STATUS_LABEL[job.status] }),
      job.cancellable ? button('Cancel', () => void cancelJob(job.id), { class: 'btn btn--sm btn--ghost' }) : null,
    ),
    job.progress !== null && job.status === 'running'
      ? el('div', { class: 'job__bar' }, el('span', { style: { width: `${Math.round(job.progress * 100)}%` } }))
      : null,
    outcome?.steps
      ? el(
          'div',
          { style: { 'margin-top': '5px' } },
          ...outcome.steps.map((step) =>
            el(
              'div',
              { style: { 'font-size': '11px' } },
              el('span', { style: { color: step.ok ? 'var(--accent)' : 'var(--danger)' }, text: step.ok ? '✓ ' : '✕ ' }),
              step.name,
              !step.ok && step.detail.length > 0 ? el('div', { class: 'job__log', text: step.detail.join('\n') }) : null,
            ),
          ),
        )
      : null,
    job.error ? el('div', { class: 'job__log', text: job.error }) : null,
    job.status === 'running' && job.log.length > 0
      ? el('div', { class: 'job__log', text: job.log.slice(-4).map((line) => line.text).join('\n') })
      : null,
  );
}

export function renderActivity(host: HTMLElement): () => void {
  function paint(state: AppState): void {
    if (!state.activityOpen) {
      replace(host);
      return;
    }
    replace(
      host,
      el(
        'div',
        { class: 'activity' },
        el(
          'div',
          { class: 'activity__head' },
          el('strong', { text: 'Activity' }),
          el('div', { class: 'grow' }),
          button('✕', () => update({ activityOpen: false }), { class: 'btn btn--ghost btn--icon btn--sm', attrs: { 'aria-label': 'Close activity' } }),
        ),
        el(
          'div',
          { class: 'activity__body' },
          state.jobs.length === 0 ? el('div', { class: 'faint', text: 'Nothing has run yet.' }) : null,
          ...state.jobs.slice(0, 20).map(jobRow),
        ),
      ),
    );
  }

  paint(getState());
  return subscribe(paint);
}
