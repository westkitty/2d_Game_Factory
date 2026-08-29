import type { WorldGraphService, WorldMapNode } from '@sw2d/contracts';

/**
 * Reusable world map overlay (capability program Phase 8).
 *
 * A semantic-DOM overlay listing the discovered nodes of a `world.graph`, the
 * current position marked, and the known connections between discovered
 * nodes. Keyboard operable: Up/Down move the selection, Escape closes. It is
 * an accessory, not a canvas element - the game keeps running behind it.
 *
 * Rendered into a caller-owned container; `dispose()` removes every listener
 * and node it created.
 */

export interface WorldMapOverlay {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
  /** Repaint from the current map state (call after a transition or discovery). */
  refresh(): void;
  dispose(): void;
}

export function createWorldMapOverlay(container: HTMLElement, graph: WorldGraphService): WorldMapOverlay {
  const root = container.ownerDocument.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'World map');
  root.hidden = true;
  root.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,8,14,0.82);z-index:20;font:13px ui-monospace,Menlo,Consolas,monospace;color:#e8ecf4';

  const panel = root.ownerDocument.createElement('div');
  panel.style.cssText = 'min-width:280px;max-width:80%;background:#12161f;border:1px solid #384054;border-radius:8px;padding:16px';
  const title = root.ownerDocument.createElement('h2');
  title.textContent = 'Map';
  title.style.cssText = 'margin:0 0 10px;font-size:14px';
  const list = root.ownerDocument.createElement('ul');
  list.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px';
  list.tabIndex = 0;
  const hint = root.ownerDocument.createElement('div');
  hint.textContent = '↑↓ select · Esc close';
  hint.style.cssText = 'margin-top:10px;color:#8b93a7;font-size:11px';
  panel.append(title, list, hint);
  root.append(panel);
  container.append(root);

  let open = false;
  let selection = 0;

  function discovered(): WorldMapNode[] {
    return graph.mapState().nodes.filter((n) => n.discovered);
  }

  function paint(): void {
    const nodes = discovered();
    if (selection >= nodes.length) selection = Math.max(0, nodes.length - 1);
    list.replaceChildren();
    nodes.forEach((n, i) => {
      const li = list.ownerDocument.createElement('li');
      const marker = n.current ? '◉ ' : n.visited ? '○ ' : '· ';
      li.textContent = `${marker}${n.displayName}${n.current ? '  (here)' : ''}`;
      li.setAttribute('data-node-id', n.id);
      li.setAttribute('aria-current', n.current ? 'true' : 'false');
      li.style.cssText = `padding:3px 8px;border-radius:4px;${i === selection ? 'background:#2b3446;' : ''}`;
      list.append(li);
    });
    const known = graph.mapState().edges.filter((e) => e.known).length;
    hint.textContent = `${nodes.length} area(s) · ${known} route(s) · ↑↓ select · Esc close`;
  }

  function onKey(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
      return;
    }
    const nodes = discovered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selection = Math.min(nodes.length - 1, selection + 1);
      paint();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selection = Math.max(0, selection - 1);
      paint();
    }
  }

  root.ownerDocument.addEventListener('keydown', onKey, true);

  const api: WorldMapOverlay = {
    get isOpen() {
      return open;
    },
    open() {
      open = true;
      root.hidden = false;
      selection = Math.max(
        0,
        discovered().findIndex((n) => n.current),
      );
      paint();
      list.focus();
    },
    close() {
      open = false;
      root.hidden = true;
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    refresh() {
      if (open) paint();
    },
    dispose() {
      root.ownerDocument.removeEventListener('keydown', onKey, true);
      root.remove();
      open = false;
    },
  };
  return api;
}
