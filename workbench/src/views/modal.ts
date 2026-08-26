/**
 * One modal implementation, used by every dialog.
 *
 * Focus is trapped while it is open and returned to whatever opened it on
 * close, and Escape always works - a dialog that can swallow keyboard focus in
 * an editor is a dialog that can strand someone.
 */

import { button, el } from '../dom.ts';

export interface ModalOptions {
  readonly title: string;
  readonly body: HTMLElement;
  readonly footer?: readonly HTMLElement[];
  readonly wide?: boolean;
  onClose?(): void;
}

export function openModal(options: ModalOptions): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const closeButton = button('✕', () => close(), { class: 'btn btn--ghost btn--icon', attrs: { 'aria-label': 'Close' } });
  const modal = el(
    'div',
    { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title }, style: options.wide ? { width: 'min(1180px, 100%)' } : {} },
    el('div', { class: 'modal__head' }, el('h2', { class: 'modal__title', text: options.title }), closeButton),
    el('div', { class: 'modal__body' }, options.body),
    options.footer && options.footer.length > 0
      ? el('div', { class: 'modal__foot' }, el('div', { class: 'grow' }), ...options.footer)
      : null,
  );

  const backdrop = el(
    'div',
    {
      class: 'modal-backdrop',
      on: {
        click: (event) => {
          if (event.target === backdrop) close();
        },
      },
    },
    modal,
  );

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.remove();
    options.onClose?.();
    previouslyFocused?.focus();
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.body.appendChild(backdrop);
  return close;
}
