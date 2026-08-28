/**
 * Find Free Sprites - the intelligent free raster-asset sourcing route.
 *
 * The shape is: know what game is being made -> derive its visual
 * requirements -> rank coherent free packs -> show exact rights -> audition ->
 * map to semantic roles through the canonical import pipeline. Downloaded art
 * is always project-local; a finished game never depends on a provider.
 *
 * This module is the entry surface. Phase A establishes the route and its
 * honest empty state; later phases fill in provider search, recommendations,
 * audition and coherent reskin.
 */

import { button, el, replace } from '../dom.ts';
import { openModal } from './modal.ts';
import { getState } from '../state.ts';
import { goPresets } from '../actions.ts';
import { openCreateDialog } from './createDialog.ts';
import * as api from '../api.ts';

interface SourceProviderInfo {
  readonly id: string;
  readonly title: string;
  readonly homepage: string;
  readonly licenseSummary: string;
  readonly online: boolean;
}

/**
 * Opens the sourcing surface.
 *
 * When a project is open, sourcing is preset-aware: the requirement profile
 * for that game drives the recommendations. From the home screen there is no
 * project yet, so the user first picks the game they are making.
 */
export async function openFindFreeSprites(): Promise<void> {
  const project = getState().current;
  const bodyHost = el('div');
  const footerHost = el('div', { class: 'row' });

  const close = openModal({
    wide: true,
    title: 'Find free sprites',
    body: bodyHost,
    footer: [footerHost],
  });

  replace(
    bodyHost,
    el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'The factory looks for coherent, free-to-use raster sprite packs that fit the game you are making. It checks each pack’s licence and provenance before anything is used, and every accepted sprite is copied into the project so the finished game needs no network to run.'),
    el('div', { class: 'empty', attrs: { 'data-testid': 'ffs-loading' }, text: 'Checking configured providers…' }),
  );

  let providers: readonly SourceProviderInfo[] = [];
  try {
    const result = await api.get<{ providers: readonly SourceProviderInfo[] }>('/sources/providers');
    providers = result.providers;
  } catch {
    // Endpoint not present yet (pre-Phase-B) - fall through to the honest
    // "no providers" state rather than surfacing a raw 404.
    providers = [];
  }

  if (providers.length === 0) {
    replace(
      bodyHost,
      el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'The factory looks for coherent, free-to-use raster sprite packs that fit the game you are making.'),
      el(
        'div',
        { class: 'infobox' },
        el('strong', { text: 'No sprite providers are configured in this build yet.' }),
        el('div', {
          style: { 'margin-top': '4px', 'font-size': '12px' },
          text: 'Free-pack sourcing is being wired up. In the meantime your game is fully playable with generated art, and you can bring in your own raster sprites at any time.',
        }),
      ),
      el(
        'div',
        { class: 'row row--wrap', style: { 'margin-top': '10px', gap: '8px' } },
        button('Use my own sprites', () => { close(); openCreateDialog({ mode: 'assets' }); }, { class: 'btn' }),
        button('Browse game presets', () => { close(); goPresets(); }, { class: 'btn' }),
      ),
    );
    replace(footerHost, el('span', { class: 'faint', text: project ? `Project: ${project.project.displayName}` : 'No project open' }));
    return;
  }

  // Provider list present (Phase B onward). The requirement-driven
  // recommendation view is layered on in later phases.
  replace(
    bodyHost,
    el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'Providers configured. Pick where the game is going and the factory will rank coherent packs by how well they cover its visual roles.'),
    el(
      'div',
      { class: 'seeds' },
      ...providers.map((provider) =>
        el(
          'div',
          { class: 'seed' },
          el('div', { class: 'seed__title', text: provider.title }),
          el('div', { class: 'seed__loop', text: provider.licenseSummary }),
          el('div', { class: 'faint', style: { 'font-size': '11px' }, text: provider.online ? 'reachable' : 'offline - cached packs only' }),
          el('div', { class: 'mono faint', style: { 'font-size': '10px' }, text: provider.homepage }),
        ),
      ),
    ),
  );
  replace(footerHost, el('span', { class: 'faint', text: project ? `Project: ${project.project.displayName}` : 'No project open' }));
}
