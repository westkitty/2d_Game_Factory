/**
 * A ~60-line DOM helper, in place of a UI framework.
 *
 * Nothing in this product's UI - a three-pane shell, a canvas editor, lists
 * and forms - is materially cheaper in React than it is here, and adding a
 * framework would be a dependency-policy event with no risk reduction to show
 * for it. See docs/architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md section 3.2.
 */

type Child = Node | string | number | false | null | undefined;

export interface ElementOptions {
  readonly class?: string;
  readonly text?: string;
  readonly html?: string;
  readonly title?: string;
  readonly disabled?: boolean;
  readonly attrs?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly on?: Readonly<Record<string, (event: Event) => void>>;
  readonly style?: Readonly<Record<string, string>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;
  // Only ever used with strings this module itself builds - never with
  // anything that came from a file name, an asset or the network.
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.title) node.title = options.title;
  if (options.disabled !== undefined && 'disabled' in node) (node as HTMLButtonElement).disabled = options.disabled;
  for (const [key, value] of Object.entries(options.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, String(value));
  }
  for (const [event, handler] of Object.entries(options.on ?? {})) node.addEventListener(event, handler);
  for (const [property, value] of Object.entries(options.style ?? {})) node.style.setProperty(property, value);
  append(node, children);
  return node;
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replace(node: Node, ...children: Child[]): void {
  clear(node);
  append(node, children);
}

export function button(label: string, onClick: () => void, options: ElementOptions = {}): HTMLButtonElement {
  return el('button', {
    ...options,
    class: options.class ?? 'btn',
    attrs: { type: 'button', ...(options.attrs ?? {}) },
    on: { click: onClick, ...(options.on ?? {}) },
  }, label);
}

export function field(labelText: string, control: HTMLElement, hint?: string): HTMLElement {
  return el('label', { class: 'field' }, el('span', { text: labelText }), control, hint ? el('div', { class: 'faint', text: hint, style: { 'font-size': '11px', 'margin-top': '3px' } }) : null);
}

/** A `<select>` whose option values are ids and whose labels are human text. */
export function select(
  options: readonly { readonly value: string; readonly label: string }[],
  value: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const node = el('select', { on: { change: (event) => onChange((event.target as HTMLSelectElement).value) } });
  for (const option of options) {
    node.appendChild(el('option', { text: option.label, attrs: { value: option.value, selected: option.value === value } }));
  }
  node.value = value;
  return node;
}

let toastTimer = 0;

export function toast(message: string, kind: 'ok' | 'warn' | 'err' = 'ok', durationMs = 4200): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = el('div', { class: `toast toast--${kind}`, text: message });
  // Add visible progress bar showing auto-dismiss countdown
  const progress = el('div', { class: 'toast__progress', style: { width: '100%', transition: `width ${durationMs}ms linear` } });
  node.appendChild(progress);
  host.appendChild(node);
  // Trigger progress animation after mount
  requestAnimationFrame(() => { progress.style.width = '0%'; });
  window.setTimeout(() => node.remove(), durationMs);
  window.clearTimeout(toastTimer);
}

/** Confirm a destructive action with a modal dialog. Returns true if confirmed. */
export function confirm(message: string, confirmLabel = 'Confirm', cancelLabel = 'Cancel'): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const dialog = el(
      'div',
      { class: 'modal', style: { width: 'min(480px, 100%)' } },
      el('div', { class: 'modal__head' }, el('h3', { class: 'modal__title', text: 'Confirm action' })),
      el(
        'div',
        { class: 'modal__body confirm-dialog' },
        el('div', { class: 'confirm-dialog__message', text: message }),
      ),
      el(
        'div',
        { class: 'modal__foot' },
        el('div', { class: 'grow' }),
        button(cancelLabel, () => { backdrop.remove(); resolve(false); }, { class: 'btn' }),
        button(confirmLabel, () => { backdrop.remove(); resolve(true); }, { class: 'btn btn--danger' }),
      ),
    );
    backdrop.appendChild(dialog);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) { backdrop.remove(); resolve(false); } });
    document.body.appendChild(backdrop);
    // Focus the cancel button for safe default
    const cancelBtn = dialog.querySelector('.btn:not(.btn--danger)') as HTMLButtonElement | null;
    cancelBtn?.focus();
  });
}

/** Keyboard shortcut registry for the workbench. */
interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  group?: string;
}

const shortcuts: Shortcut[] = [];

export function registerShortcut(shortcut: Shortcut): () => void {
  shortcuts.push(shortcut);
  return () => {
    const index = shortcuts.indexOf(shortcut);
    if (index >= 0) shortcuts.splice(index, 1);
  };
}

function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (!!shortcut.ctrl !== (event.ctrlKey || event.metaKey)) return false;
  if (!!shortcut.shift !== event.shiftKey) return false;
  if (!!shortcut.alt !== event.altKey) return false;
  // Don't trigger when typing in inputs
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return false;
  return true;
}

// Global keyboard handler - only active in browser environments
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    for (const shortcut of shortcuts) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  });
}

/** Show keyboard shortcuts overlay. */
export function showShortcuts(): void {
  const existing = document.querySelector('.shortcuts-overlay');
  if (existing) { existing.remove(); return; }

  const groups = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts) {
    const group = shortcut.group ?? 'General';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(shortcut);
  }

  const overlay = el('div', { class: 'shortcuts-overlay' });
  const panel = el('div', { class: 'shortcuts-panel' }, el('h2', { text: 'Keyboard Shortcuts' }));

  for (const [group, items] of groups) {
    const section = el('div', { class: 'shortcuts-group' }, el('h3', { text: group }));
    for (const shortcut of items) {
      const keys: string[] = [];
      if (shortcut.ctrl) keys.push('Ctrl');
      if (shortcut.shift) keys.push('Shift');
      if (shortcut.alt) keys.push('Alt');
      keys.push(shortcut.key.toUpperCase());
      section.appendChild(
        el(
          'div',
          { class: 'shortcut-row' },
          el('span', { text: shortcut.description }),
          el('div', { class: 'shortcut-keys' }, ...keys.map((k) => el('span', { class: 'kbd', text: k }))),
        ),
      );
    }
    panel.appendChild(section);
  }

  panel.appendChild(button('Close', () => overlay.remove(), { class: 'btn', style: { 'margin-top': '16px' } }));
  overlay.appendChild(panel);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Register the shortcuts overlay shortcut
registerShortcut({ key: '?', shift: true, description: 'Show keyboard shortcuts', action: showShortcuts, group: 'General' });

/** Format a keyboard shortcut for display. */
export function formatShortcut(key: string, ctrl = false, shift = false, alt = false): string {
  const parts: string[] = [];
  if (ctrl) parts.push('Ctrl');
  if (shift) parts.push('Shift');
  if (alt) parts.push('Alt');
  parts.push(key.toUpperCase());
  return parts.join('+');
}

/** Formats a byte count the way a person reads it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function maturityBadgeClass(maturity: string): string {
  if (maturity === 'proof-validated') return 'badge badge--proof';
  if (maturity === 'smoke-validated') return 'badge badge--smoke';
  return 'badge badge--recipe';
}

/** Plain-English starter-kit depth. Starter depth and preset evidence maturity are separate claims (F15). */
export function depthLabel(depth: string): string {
  if (depth === 'rich-proof-kit' || depth === 'rich-starter-kit') return 'Rich starter kit';
  if (depth === 'smoke-kit') return 'Smoke-validated demo';
  return 'Generated shell';
}

export function depthExplanation(depth: string): string {
  if (depth === 'rich-proof-kit') return 'A playable starting point derived from a committed, proof-validated game: a designed level, real mechanics, and your art wired in.';
  if (depth === 'rich-starter-kit') return 'A designed playable starter with real genre mechanics and semantic-role art. It is richer than a generated shell, but it does not change the preset’s evidence maturity.';
  if (depth === 'smoke-kit') return 'A working composition with a committed browser-smoke-tested demo behind it, but no deep proof game. Expect a starting point, not a finished genre.';
  return 'A working generated shell: it boots, installs its packs and takes input. The genre mechanics are yours to write.';
}
