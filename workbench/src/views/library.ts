/**
 * The asset library (left pane).
 *
 * Searchable, folder-grouped, grid or list, with role and staleness visible on
 * the thumbnail. Every one of those is a GDevelop lesson: a project with two
 * hundred assets is unusable without search and folders, and hidden reimport
 * state is the specific thing their users complain about, so "stale" is a
 * badge on the tile rather than something you discover when the game looks
 * wrong.
 *
 * Thumbnails are generated lazily, one screenful at a time, and cached with a
 * bound - see `thumbnailFor`.
 */

import { el, button, replace, formatBytes } from '../dom.ts';
import * as api from '../api.ts';
import { getState, subscribe, update, type AppState } from '../state.ts';
import { savePanels } from '../actions.ts';
import { openImportInbox } from './importInbox.ts';
import { thumbnailFor } from '../image/clientImage.ts';
import { ROLE_LABELS, type AssetRecord } from '../../shared/types.ts';

function matches(asset: AssetRecord, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = `${asset.displayName} ${asset.folder ?? ''} ${asset.group ?? ''} ${asset.roleAssignments.join(' ')}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function renderLibrary(host: HTMLElement): () => void {
  let query = '';

  const search = el('input', {
    attrs: { type: 'search', placeholder: 'Search assets…', 'aria-label': 'Search assets' },
    on: { input: (event) => { query = (event.target as HTMLInputElement).value; paint(getState()); } },
  });

  const body = el('div', { class: 'pane__body' });
  const head = el('div', { class: 'pane__head' }, el('span', { class: 'pane__title', text: 'Assets' }));

  function thumbFor(asset: AssetRecord, into: HTMLImageElement, gameId: string): void {
    const url = api.assetUrl(gameId, asset.id, asset.sha256);
    void thumbnailFor(`${asset.id}:${asset.sha256}`, url, 96)
      .then((dataUrl) => { into.src = dataUrl; })
      // A missing file is a real state (a deleted derivative), not a crash.
      .catch(() => { into.alt = 'missing'; into.replaceWith(el('span', { class: 'faint', style: { 'font-size': '9px' }, text: 'missing' })); });
  }

  function tile(asset: AssetRecord, gameId: string, selected: boolean): HTMLElement {
    const image = el('img', { attrs: { alt: '' } });
    thumbFor(asset, image, gameId);
    const role = asset.roleAssignments[0];
    return el(
      'div',
      {
        class: 'lib-item',
        attrs: { role: 'option', 'aria-selected': selected, tabindex: '0', 'data-asset-id': asset.id, title: `${asset.displayName} · ${asset.width}x${asset.height} · ${formatBytes(asset.byteSize)}` },
        on: {
          click: () => update({ selectedAssetId: asset.id }),
          keydown: (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === 'Enter' || key === ' ') {
              event.preventDefault();
              update({ selectedAssetId: asset.id });
            }
          },
        },
      },
      el('div', { class: 'lib-item__thumb' }, image),
      el('div', { class: 'lib-item__name', text: asset.displayName }),
      asset.stale
        ? el('div', { class: 'lib-item__tag lib-item__tag--stale', text: 'stale', title: 'Its source changed and this has not been rebuilt yet' })
        : role
          ? el('div', { class: 'lib-item__tag', text: ROLE_LABELS[role].slice(0, 4) })
          : asset.kind === 'derived'
            ? el('div', { class: 'lib-item__tag lib-item__tag--derived', text: 'der' })
            : null,
    );
  }

  function row(asset: AssetRecord, gameId: string, selected: boolean): HTMLElement {
    const image = el('img', { attrs: { alt: '' } });
    thumbFor(asset, image, gameId);
    return el(
      'div',
      {
        class: 'lib-row',
        attrs: { role: 'option', 'aria-selected': selected, tabindex: '0', 'data-asset-id': asset.id },
        on: { click: () => update({ selectedAssetId: asset.id }) },
      },
      el('div', { class: 'lib-row__thumb' }, image),
      el('div', { class: 'grow truncate' }, asset.displayName),
      asset.stale ? el('span', { class: 'badge badge--danger', text: 'stale' }) : null,
      ...asset.roleAssignments.map((role) => el('span', { class: 'badge badge--role', text: role })),
    );
  }

  function paint(state: AppState): void {
    const current = state.current;
    replace(
      head,
      el('span', { class: 'pane__title', text: 'Assets' }),
      el('div', { class: 'grow' }),
      button(state.panels.libraryView === 'grid' ? '☰' : '▦', () => savePanels({ libraryView: state.panels.libraryView === 'grid' ? 'list' : 'grid' }), {
        class: 'btn btn--ghost btn--icon btn--sm',
        title: state.panels.libraryView === 'grid' ? 'Switch to list' : 'Switch to grid',
      }),
      button('+', () => {
        if (!current) return;
        openImportInbox({ gameId: current.project.gameId, onDone: () => undefined });
      }, { class: 'btn btn--sm', title: 'Import assets' }),
    );

    if (!current) {
      replace(body, el('div', { class: 'faint', text: 'No project open.' }));
      return;
    }

    const filtered = current.assets.filter((asset) => matches(asset, query));
    if (current.assets.length === 0) {
      replace(
        body,
        search,
        el(
          'div',
          { class: 'empty', style: { 'margin-top': '12px', padding: '18px' } },
          el('strong', { text: 'No assets yet' }),
          el('div', { style: { 'font-size': '12px', 'margin-bottom': '10px' }, text: 'Bring in an image, a folder, a sprite sheet or a ZIP. Your game is already playable with generated art - your art replaces it role by role.' }),
          button('Import assets', () => openImportInbox({ gameId: current.project.gameId, onDone: () => undefined }), { class: 'btn btn--primary btn--sm' }),
        ),
      );
      return;
    }

    // Folders come from the imported relative path and are display-only:
    // identity is the asset id, so moving a file between folders never breaks
    // a role assignment (P02).
    const folders = new Map<string, AssetRecord[]>();
    for (const asset of filtered) {
      const key = asset.folder ?? '';
      const bucket = folders.get(key);
      if (bucket) bucket.push(asset);
      else folders.set(key, [asset]);
    }

    const sections = [...folders.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([folder, assets]) =>
        el(
          'div',
          { class: 'folder' },
          folder ? el('div', { class: 'folder__head' }, el('span', { text: `📁 ${folder}` }), el('span', { class: 'faint', text: String(assets.length) })) : null,
          state.panels.libraryView === 'grid'
            ? el('div', { class: 'lib-grid', attrs: { role: 'listbox', 'aria-label': folder || 'Assets' } }, ...assets.map((asset) => tile(asset, current.project.gameId, asset.id === state.selectedAssetId)))
            : el('div', { class: 'lib-list', attrs: { role: 'listbox', 'aria-label': folder || 'Assets' } }, ...assets.map((asset) => row(asset, current.project.gameId, asset.id === state.selectedAssetId))),
        ),
      );

    replace(
      body,
      search,
      el('div', { class: 'faint', style: { 'font-size': '11px', margin: '8px 0 6px' }, text: `${filtered.length} of ${current.assets.length} shown` }),
      ...sections,
      filtered.length === 0 ? el('div', { class: 'empty', style: { padding: '16px' }, text: 'Nothing matches that search.' }) : null,
    );
  }

  replace(host, head, body);
  paint(getState());
  return subscribe(paint);
}
