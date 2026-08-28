/**
 * The workspace shell: library | work surface | inspector, with a top bar, a
 * tab strip and a status bar.
 *
 * The panel geometry is persisted per project (acceptance W21) and the
 * splitters are real drag handles, because an editor whose panes cannot be
 * resized is an editor that fights whatever the user is actually doing.
 *
 * Below 1000px the three panes collapse to one, switched by a tab bar. That is
 * a fallback, not a claim that a phone is a good place to compose a level -
 * what it guarantees is that the layout never breaks and import, create,
 * preview and status stay reachable.
 */

import { el, button, replace } from '../dom.ts';
import { anyJobRunning, getState, latestJob, subscribe, update, type AppState } from '../state.ts';
import { goHome, reveal, runPipeline, savePanels, startPreview, synthesizeTheme } from '../actions.ts';
import { renderLibrary } from './library.ts';
import { renderInspector } from './inspector.ts';
import { renderAssetLab } from './assetLab.ts';
import { renderSceneComposer } from './sceneComposer.ts';
import { renderPreview } from './previewPane.ts';
import { renderActivity } from './activity.ts';
import { openImportInbox } from './importInbox.ts';
import { maturityBadgeClass, depthLabel } from '../dom.ts';

type Workspace = 'lab' | 'scene' | 'preview';

export function renderWorkspace(host: HTMLElement): () => void {
  const disposers: (() => void)[] = [];
  let active: Workspace = getState().panels.activeWorkspace;
  let disposeCenter: (() => void) | null = null;

  const libraryPane = el('div', { class: 'pane pane--library' });
  const inspectorPane = el('div', { class: 'pane pane--inspector' });
  const tabs = el('div', { class: 'tabs' });
  const centerBody = el('div', { style: { flex: '1 1 auto', display: 'flex', 'flex-direction': 'column', 'min-height': '0' } });
  const topbar = el('div', { class: 'topbar' });
  const guidebar = el('div', { class: 'guidebar' });
  const statusbar = el('div', { class: 'statusbar' });
  const activityHost = el('div');

  const leftResizer = el('div', { class: 'resizer', attrs: { role: 'separator', 'aria-label': 'Resize asset library' } });
  const rightResizer = el('div', { class: 'resizer', attrs: { role: 'separator', 'aria-label': 'Resize inspector' } });

  const workspaceGrid = el(
    'div',
    { class: 'workspace', attrs: { 'data-mobile-pane': 'center' } },
    el('div', { style: { display: 'flex', 'min-height': '0' } }, libraryPane, leftResizer),
    el('div', { class: 'pane pane--center', style: { display: 'flex', 'flex-direction': 'column', 'min-height': '0' } }, tabs, centerBody),
    el('div', { style: { display: 'flex', 'min-height': '0' } }, rightResizer, inspectorPane),
  );

  function mountCenter(): void {
    disposeCenter?.();
    if (active === 'lab') disposeCenter = renderAssetLab(centerBody);
    else if (active === 'scene') disposeCenter = renderSceneComposer(centerBody);
    else disposeCenter = renderPreview(centerBody);
  }

  function activate(next: Workspace): void {
    if (active === next) return;
    active = next;
    savePanels({ activeWorkspace: next });
    paintTabs();
    mountCenter();
  }

  function paintTabs(): void {
    const entries: readonly { readonly id: Workspace; readonly label: string; readonly hint: string }[] = [
      { id: 'lab', label: 'Asset Lab', hint: 'Crop, mask, slice and derive from your art' },
      { id: 'scene', label: 'Scene', hint: 'Move the level around visually' },
      { id: 'preview', label: 'Preview', hint: 'Play the real generated game' },
    ];
    replace(
      tabs,
      ...entries.map((entry) =>
        button(entry.label, () => activate(entry.id), { class: 'tab', title: entry.hint, attrs: { 'aria-selected': active === entry.id, role: 'tab' } }),
      ),
      el('div', { class: 'grow' }),
      el(
        'div',
        { class: 'mobile-panes row', style: { gap: '2px', 'padding-bottom': '6px' } },
        button('Assets', () => setMobilePane('library'), { class: 'btn btn--sm btn--ghost' }),
        button('Work', () => setMobilePane('center'), { class: 'btn btn--sm btn--ghost' }),
        button('Details', () => setMobilePane('inspector'), { class: 'btn btn--sm btn--ghost' }),
      ),
    );
  }

  function paintGuide(state: AppState): void {
    const current = state.current;
    if (!current) return;
    const validSprites = current.assets.filter((asset) => asset.validation?.purpose === 'sprite' && asset.validation.status === 'valid' && !asset.stale).length;
    const assigned = current.blueprint.roleAssignments.filter((entry) => entry.assetId !== null).length;
    const steps: readonly { label: string; detail: string; workspace: Workspace; done: boolean }[] = [
      { label: 'Add art', detail: `${current.assets.filter((asset) => asset.kind === 'source').length} source image${current.assets.filter((asset) => asset.kind === 'source').length === 1 ? '' : 's'}`, workspace: 'lab', done: current.assets.length > 0 },
      { label: 'Make sprites', detail: `${validSprites} validated`, workspace: 'lab', done: validSprites > 0 },
      { label: 'Compose', detail: `${assigned} role${assigned === 1 ? '' : 's'} assigned`, workspace: 'scene', done: assigned > 0 },
      { label: 'Play', detail: current.preview ? 'running now' : 'ready to run', workspace: 'preview', done: Boolean(current.preview) },
    ];
    replace(
      guidebar,
      el('div', { class: 'guidebar__label' }, el('span', { text: 'BUILD TRACK' }), el('strong', { text: 'Follow the steps, then play the actual game.' })),
      el(
        'div',
        { class: 'guidebar__steps' },
        ...steps.map((step, index) =>
          button(`${index + 1}. ${step.label}`, () => activate(step.workspace), {
            class: `guide-step${active === step.workspace ? ' guide-step--active' : ''}${step.done ? ' guide-step--done' : ''}`,
            title: step.detail,
            attrs: { 'aria-label': `${step.label}: ${step.detail}` },
          }),
        ),
      ),
      button(current.preview ? 'Game running' : 'Run game', () => {
        activate('preview');
        if (!current.preview) void startPreview('fast');
      }, { class: 'btn btn--run', attrs: { 'data-testid': 'run-game' } }),
    );
  }

  function setMobilePane(pane: AppState['mobilePane']): void {
    workspaceGrid.setAttribute('data-mobile-pane', pane);
    update({ mobilePane: pane });
  }

  function paintTopbar(state: AppState): void {
    const current = state.current;
    if (!current) return;
    const busy = anyJobRunning();

    replace(
      topbar,
      el('div', { class: 'topbar__brand' }, el('b', { text: 'SW2D' }), el('span', { text: 'Workbench' })),
      el('div', { class: 'topbar__sep' }),
      button('← Projects', () => goHome(), { class: 'btn btn--ghost btn--sm' }),
      el(
        'div',
        { class: 'topbar__meta' },
        el('strong', { class: 'truncate', text: current.project.displayName }),
        el('span', { class: 'truncate', text: `${current.project.presetId}${current.project.adopted ? ' · adopted' : ''}` }),
      ),
      current.preset ? el('span', { class: maturityBadgeClass(current.preset.maturity), text: current.preset.maturity }) : null,
      current.preset ? el('span', { class: 'badge', text: depthLabel(current.preset.starterKitDepth) }) : null,
      el('div', { class: 'grow' }),
      button('Import', () => openImportInbox({ gameId: current.project.gameId, onDone: () => undefined }), { class: 'btn btn--sm' }),
      button('Re-theme', () => void synthesizeTheme(), { class: 'btn btn--sm', title: 'Rewrite the theme from the current roles and palette' }),
      el('div', { class: 'topbar__sep' }),
      button('Run game', () => {
        activate('preview');
        void startPreview('fast');
      }, { class: 'btn btn--run btn--sm', title: 'Open and run the real generated game' }),
      button('Validate', () => void runPipeline('validate'), { class: 'btn btn--sm', disabled: busy }),
      button('Build', () => void runPipeline('build'), { class: 'btn btn--sm', disabled: busy }),
      button('Pack', () => void runPipeline('pack'), { class: 'btn btn--sm', disabled: busy, title: 'Produce an offline-verified, checksummed release candidate' }),
      button('Reveal', () => void reveal(current.summary.lastBuildState === 'packed' ? 'pack' : 'project'), { class: 'btn btn--sm btn--ghost', title: 'Show this project in your file browser' }),
    );
  }

  function paintStatus(state: AppState): void {
    const job = latestJob();
    const busy = anyJobRunning();
    const failed = job?.status === 'failed';
    const current = state.current;

    replace(
      statusbar,
      el('span', { class: `statusbar__dot${busy ? ' statusbar__dot--busy' : failed ? ' statusbar__dot--fail' : ''}` }),
      el('span', { text: state.busy ?? (busy ? `${job?.label}: ${job?.step}` : failed ? `${job?.label} failed` : 'Idle') }),
      el('div', { class: 'grow' }),
      current?.summary.provenanceBlocked
        ? el('span', { class: 'badge badge--danger', text: 'provenance blocks release', title: 'One or more assets have unknown provenance. Pack will refuse until resolved.' })
        : null,
      current ? el('span', { class: 'faint', text: `${current.assets.length} assets` }) : null,
      current?.preview ? el('span', { class: 'faint', text: `${current.preview.mode} preview running` }) : null,
      el('span', { class: 'faint', text: 'local only · no network' }),
      button(state.activityOpen ? 'Activity ▾' : 'Activity ▸', () => update({ activityOpen: !state.activityOpen }), { class: 'btn btn--ghost btn--sm' }),
    );
  }

  // --- splitters ------------------------------------------------------------

  function makeResizer(node: HTMLElement, pane: HTMLElement, key: 'libraryWidth' | 'inspectorWidth', invert: boolean): void {
    node.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startWidth = pane.getBoundingClientRect().width;
      const onMove = (moveEvent: PointerEvent): void => {
        const delta = (moveEvent.clientX - startX) * (invert ? -1 : 1);
        const width = Math.max(180, Math.min(560, startWidth + delta));
        pane.style.width = `${width}px`;
      };
      const onUp = (): void => {
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerup', onUp);
        savePanels({ [key]: Math.round(pane.getBoundingClientRect().width) } as never);
      };
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', onUp);
    });
  }

  makeResizer(leftResizer, libraryPane, 'libraryWidth', false);
  makeResizer(rightResizer, inspectorPane, 'inspectorWidth', true);

  const initial = getState();
  libraryPane.style.width = `${initial.panels.libraryWidth}px`;
  inspectorPane.style.width = `${initial.panels.inspectorWidth}px`;

  replace(host, topbar, guidebar, workspaceGrid, statusbar, activityHost);

  disposers.push(renderLibrary(libraryPane));
  disposers.push(renderInspector(inspectorPane));
  disposers.push(renderActivity(activityHost));
  paintTabs();
  mountCenter();
  paintTopbar(initial);
  paintGuide(initial);
  paintStatus(initial);

  disposers.push(
    subscribe((state) => {
      if (state.panels.activeWorkspace !== active) {
        active = state.panels.activeWorkspace;
        paintTabs();
        mountCenter();
      }
      paintTopbar(state);
      paintGuide(state);
      paintStatus(state);
    }),
  );

  return () => {
    disposeCenter?.();
    for (const dispose of disposers) dispose();
  };
}
