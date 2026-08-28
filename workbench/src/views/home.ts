/**
 * The project home.
 *
 * The product makes browser games. An image is optional. So the front door
 * leads with "Make a Game" - pick a type, create instantly, play with
 * generated art - and every art route (your own sprites, free sourced packs,
 * one image) is a peer option below it, never a precondition (acceptance W02,
 * architectural law 1).
 */

import { button, el, maturityBadgeClass, replace, toast } from '../dom.ts';
import { getState, subscribe, type AppState } from '../state.ts';
import { goPresets, openProject, openProjectAndRun, refreshProjects } from '../actions.ts';
import { openCreateDialog } from './createDialog.ts';
import { openImportFirstFlow } from './importFirstFlow.ts';
import { openFindFreeSprites } from './findFreeSprites.ts';
import * as api from '../api.ts';

function actionCard(
  marker: string,
  title: string,
  description: string,
  onClick: () => void,
  hero = false,
): HTMLElement {
  return el(
    'button',
    { class: `action${hero ? ' action--hero' : ''}`, attrs: { type: 'button' }, on: { click: onClick } },
    el('div', { class: 'action__marker', text: marker }),
    el('div', { class: 'action__title', text: title }),
    el('div', { class: 'action__desc', text: description }),
  );
}

function projectCard(summary: AppState['projects'][number]): HTMLElement {
  const thumb = el('div', { class: 'card__thumb' }, el('span', { class: 'faint', text: 'no art yet' }));
  if (summary.thumbnailAssetId) {
    const image = el('img', { attrs: { alt: '', loading: 'lazy' } });
    // Asset bytes sit behind the session token, so they are fetched and handed
    // over as an object URL rather than assigned as a plain src.
    void api
      .assetBlobUrl(summary.gameId, summary.thumbnailAssetId, summary.gameId)
      .then((url) => {
        image.src = url;
        replace(thumb, image);
      })
      .catch(() => undefined);
  }

  return el(
    'div',
    { class: 'project-card' },
    el(
      'button',
      { class: 'card', attrs: { type: 'button' }, on: { click: () => void openProject(summary.gameId) } },
      thumb,
      el(
        'div',
        { class: 'card__head' },
        el('span', { class: 'card__name truncate', text: summary.displayName }),
        el('span', { class: maturityBadgeClass(summary.maturity), text: summary.maturity }),
      ),
      el(
        'div',
        { class: 'card__meta' },
        el('span', { class: 'mono', text: summary.presetId }),
        el('span', { text: `${summary.assetCount} asset${summary.assetCount === 1 ? '' : 's'}` }),
        el('span', { text: summary.lastBuildState === 'packed' ? 'packed' : summary.lastBuildState === 'built' ? 'built' : 'not built' }),
        !summary.hasWorkbenchMetadata ? el('span', { class: 'badge', text: 'adopt on open' }) : null,
        summary.provenanceBlocked ? el('span', { class: 'badge badge--danger', text: 'provenance blocks release' }) : null,
      ),
      el('span', { class: 'card__edit', text: 'Open editor' }),
    ),
    button('Run game', () => void openProjectAndRun(summary.gameId), { class: 'btn btn--run btn--project', attrs: { 'aria-label': `Run ${summary.displayName}` } }),
  );
}

export function renderHome(host: HTMLElement): () => void {
  const projectsHost = el('div');

  function paint(state: AppState): void {
    replace(
      projectsHost,
      state.projects.length === 0
        ? el(
            'div',
            { class: 'empty' },
            el('strong', { text: 'No games here yet' }),
            el('div', { text: 'Pick a game type and press create - art is something you add afterwards, not before.' }),
          )
        : el('div', { class: 'cards' }, ...state.projects.map(projectCard)),
    );
  }

  replace(
    host,
    el(
      'div',
      { class: 'home' },
      el(
        'div',
        { class: 'home__inner' },
        el('div', { class: 'home__eyebrow', text: 'Make browser games. An image is optional.' }),
        el('h1', { class: 'home__title', text: 'Stinky Weasel Game Factory' }),
        el('p', {
          class: 'home__sub',
          text: 'Choose a game type and the factory builds a real, playable browser game with generated art straight away. Bring your own sprites, source free ones, or start from one image whenever you want - each is one route in, never a requirement. Finished games need no network to run.',
        }),
        el(
          'div',
          { class: 'build-track', attrs: { 'aria-label': 'How the factory works' } },
          ...['Pick a game type', 'Create - playable now', 'Add art if you want', 'Run and pack offline'].map((label, index) =>
            el('div', { class: 'build-track__step' }, el('span', { text: String(index + 1).padStart(2, '0') }), el('strong', { text: label })),
          ),
        ),
        el(
          'div',
          { class: 'actions' },
          actionCard(
            'START HERE',
            'Make a Game',
            'Pick a game type or preset and create it now. It is playable immediately with generated art - no image, upload, account or terminal.',
            () => openCreateDialog({ mode: 'gameplay' }),
            true,
          ),
          actionCard('YOUR ART', 'Use My Sprites', 'Start a project, then bring in a folder, sprite sheet or ZIP of your own raster art and map it onto game roles.', () =>
            openCreateDialog({ mode: 'assets' }),
          ),
          actionCard('FREE PACKS', 'Find Free Sprites', 'Let the factory find coherent, free-to-use raster sprite packs that fit the game you are making, with licence and provenance checked before use.', () =>
            void openFindFreeSprites(),
          ),
          actionCard('ONE IMAGE', 'Make Something From an Image', 'Import a single image, choose a playable direction, and let the factory derive validated sprite art before it opens the finished game.', () =>
            void openImportFirstFlow(),
          ),
          actionCard('PROJECTS', 'Open Existing Project', 'Reopen a game made here, or adopt one generated by the command-line interface (CLI).', () => {
            const { projects } = getState();
            if (projects.length === 0) {
              toast('No projects under games/ yet. Make one first.', 'warn');
              return;
            }
            document.getElementById('recent-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }),
          actionCard('RECIPES', 'Browse Presets', 'Browse every genre recipe with its maturity, required systems, and known limitations.', () => goPresets()),
        ),
        el('div', { attrs: { id: 'recent-projects' } }, el('h2', { class: 'section-title', text: 'Your games' }), projectsHost),
        el(
          'div',
          { style: { 'margin-top': '30px' } },
          el('h2', { class: 'section-title', text: 'What this is running on' }),
          el(
            'div',
            { class: 'infobox' },
            el('div', { text: 'This workbench drives the SW2D factory directly: the same generator, schemas, content pipeline and release packer the command line uses. Games it makes are ordinary SW2D projects - editable outside the workbench, buildable without it, and with no network access required to play.' }),
          ),
        ),
      ),
    ),
  );

  paint(getState());
  void refreshProjects();
  return subscribe(paint);
}

/** Kept for the preset browser's "create from this preset" path. */
export { openCreateDialog };
export { button };
