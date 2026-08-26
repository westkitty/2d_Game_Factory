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
  host.appendChild(node);
  window.setTimeout(() => node.remove(), durationMs);
  window.clearTimeout(toastTimer);
}

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

/** Starter depth and preset evidence maturity are separate claims. */
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
