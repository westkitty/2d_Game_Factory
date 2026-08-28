/**
 * Find Free Sprites - the intelligent free raster-asset sourcing route.
 *
 * The shape is: know what game is being made -> derive its visual
 * requirements -> rank coherent free packs -> show exact rights -> audition ->
 * map to semantic roles through the canonical import pipeline. Downloaded art
 * is always project-local; a finished game never depends on a provider.
 *
 * Phase B: providers and the curated catalogue with exact rights, plus the
 * acquisition plumbing (download -> canonical staged import). Preset-aware
 * ranking (Phase C), audition and coherent reskin (Phase D) layer on top.
 */

import { button, el, replace, toast } from '../dom.ts';
import { openModal } from './modal.ts';
import { getState } from '../state.ts';
import { awaitJob, errorText, goPresets, openProject, refreshCurrent } from '../actions.ts';
import { openCreateDialog } from './createDialog.ts';
import { ROLE_LABELS, type WorkbenchAssetRole } from '../../shared/types.ts';
import type { SourceCandidate, SourceProviderInfo, RightsStatus } from '../../server/sources/types.ts';
import * as api from '../api.ts';

const RIGHTS_LABEL: Readonly<Record<RightsStatus, string>> = {
  verified: 'VERIFIED',
  'attribution-required': 'ATTRIBUTION REQUIRED',
  'stale-verification': 'STALE VERIFICATION',
  'unsupported-license': 'UNSUPPORTED LICENCE',
  unknown: 'UNKNOWN / BLOCKED',
};

const RIGHTS_CLASS: Readonly<Record<RightsStatus, string>> = {
  verified: 'badge badge--proof',
  'attribution-required': 'badge badge--recipe',
  'stale-verification': 'badge badge--recipe',
  'unsupported-license': 'badge badge--danger',
  unknown: 'badge badge--danger',
};

function rightsUsable(status: RightsStatus): boolean {
  return status === 'verified' || status === 'attribution-required' || status === 'stale-verification';
}

function candidateCard(candidate: SourceCandidate, onAcquire: ((c: SourceCandidate) => void) | null): HTMLElement {
  const roleHints = Object.entries(candidate.roleHints)
    .filter(([, weight]) => (weight ?? 0) >= 0.5)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([role]) => role as WorkbenchAssetRole);

  const usable = rightsUsable(candidate.rights.status);

  return el(
    'div',
    { class: 'seed', attrs: { 'data-pack-id': candidate.packId } },
    el(
      'div',
      { class: 'row row--wrap', style: { gap: '6px' } },
      el('span', { class: RIGHTS_CLASS[candidate.rights.status], text: RIGHTS_LABEL[candidate.rights.status] }),
      el('span', { class: 'badge', text: candidate.rights.licenseName }),
      candidate.camera ? el('span', { class: 'badge', text: candidate.camera }) : null,
      candidate.tileSize ? el('span', { class: 'badge', text: `${candidate.tileSize.width}x${candidate.tileSize.height}` }) : null,
      candidate.pixelArt ? el('span', { class: 'badge', text: 'pixel art' }) : null,
      candidate.hasAnimationFrames ? el('span', { class: 'badge', text: 'has frames' }) : null,
    ),
    el('div', { class: 'seed__title', text: candidate.title }),
    el('div', { class: 'seed__loop', text: `${candidate.creator} · ${candidate.fileCount ?? '?'} files · PNG${candidate.containsSvgAlongsidePng ? ' (SVG in pack is ignored)' : ''}` }),
    roleHints.length > 0
      ? el(
          'div',
          { class: 'faint', style: { 'font-size': '11px' } },
          `Likely covers: ${roleHints.map((role) => ROLE_LABELS[role]).join(', ')}`,
        )
      : null,
    el(
      'div',
      { class: 'seed__limits' },
      candidate.rights.attributionRequired
        ? `Credit required when shipped${candidate.rights.attributionText ? `: ${candidate.rights.attributionText}` : ` (mention "${candidate.creator}")`}.`
        : 'No attribution required.',
      el('div', { class: 'mono faint', style: { 'font-size': '10px', 'margin-top': '3px' }, text: candidate.rights.evidenceUrl }),
    ),
    onAcquire
      ? button(usable ? 'Acquire pack' : 'Blocked by licence', () => onAcquire(candidate), {
          class: usable ? 'btn btn--primary' : 'btn',
          disabled: !usable,
          title: usable ? `Download from ${candidate.acquisitionUrl}` : 'This licence is not on the accepted list.',
        })
      : el('div', { class: 'faint', style: { 'font-size': '11px' }, text: 'Open a project to acquire this pack.' }),
  );
}

/**
 * Opens the sourcing surface. Preset-aware when a project is open; otherwise
 * the user is pointed at creating a game first.
 */
export async function openFindFreeSprites(): Promise<void> {
  const project = getState().current;
  const bodyHost = el('div');
  const footerHost = el('div', { class: 'row' });

  const close = openModal({ wide: true, title: 'Find free sprites', body: bodyHost, footer: [footerHost] });

  replace(
    bodyHost,
    el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'The factory looks for coherent, free-to-use raster sprite packs that fit the game you are making. Each pack’s licence and provenance is shown before anything is downloaded, and every accepted sprite is copied into the project so the finished game needs no network to run.'),
    el('div', { class: 'empty', attrs: { 'data-testid': 'ffs-loading' }, text: 'Checking configured providers…' }),
  );

  let providers: readonly SourceProviderInfo[] = [];
  let candidates: readonly SourceCandidate[] = [];
  try {
    const [p, c] = await Promise.all([
      api.get<{ providers: readonly SourceProviderInfo[] }>('/sources/providers'),
      api.get<{ candidates: readonly SourceCandidate[] }>('/sources/catalog'),
    ]);
    providers = p.providers;
    candidates = c.candidates;
  } catch {
    providers = [];
    candidates = [];
  }

  if (providers.length === 0) {
    replace(
      bodyHost,
      el('div', { class: 'infobox' }, el('strong', { text: 'No sprite providers are configured in this build.' }), el('div', { style: { 'font-size': '12px', 'margin-top': '4px' }, text: 'Your game is fully playable with generated art, and you can bring in your own raster sprites at any time.' })),
      el('div', { class: 'row row--wrap', style: { 'margin-top': '10px', gap: '8px' } }, button('Use my own sprites', () => { close(); openCreateDialog({ mode: 'assets' }); }, { class: 'btn' }), button('Browse game presets', () => { close(); goPresets(); }, { class: 'btn' })),
    );
    replace(footerHost, el('span', { class: 'faint', text: project ? `Project: ${project.project.displayName}` : 'No project open' }));
    return;
  }

  const gameId = project?.project.gameId ?? null;

  async function acquire(candidate: SourceCandidate): Promise<void> {
    if (!gameId) return;
    try {
      const { jobId } = await api.post<{ jobId: string }>('/sources/acquire', {
        gameId,
        providerId: candidate.providerId,
        packId: candidate.packId,
      });
      const job = await awaitJob(jobId, `Acquiring ${candidate.title}`);
      if (job.status !== 'completed') {
        toast(job.error ?? 'Acquisition failed.', 'err');
        return;
      }
      const outcome = job.result as
        | { result: { batchId: string; staged: number; ignored: number; svgOnly: boolean; provenance: unknown }; plan: { files: readonly { stagingId: string; displayName: string; suggestedRoles: readonly WorkbenchAssetRole[] }[] } }
        | undefined;
      if (!outcome) {
        toast('Acquisition finished but returned nothing.', 'warn');
        return;
      }
      if (outcome.result.svgOnly) {
        toast(`"${candidate.title}" contained only SVG art and cannot be used for sprites.`, 'warn');
        try { await api.post('/import/discard', { gameId, batchId: outcome.result.batchId }); } catch { /* best effort */ }
        return;
      }
      if (outcome.result.staged === 0) {
        toast(`"${candidate.title}" produced no usable raster images.`, 'warn');
        return;
      }
      await reviewPlan(candidate, outcome.result.batchId, outcome.result.provenance, outcome.plan.files);
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  async function reviewPlan(
    candidate: SourceCandidate,
    batchId: string,
    provenance: unknown,
    files: readonly { stagingId: string; displayName: string; suggestedRoles: readonly WorkbenchAssetRole[] }[],
  ): Promise<void> {
    if (!gameId) return;
    const selections = new Map<string, WorkbenchAssetRole | ''>();
    for (const file of files) selections.set(file.stagingId, file.suggestedRoles[0] ?? '');

    const rows = files.slice(0, 200).map((file) =>
      el(
        'tr',
        {},
        el('td', { text: file.displayName }),
        el(
          'td',
          {},
          el(
            'select',
            { on: { change: (event) => selections.set(file.stagingId, (event.target as HTMLSelectElement).value as WorkbenchAssetRole | '') } },
            el('option', { text: '— import, no role —', attrs: { value: '' } }),
            ...(Object.keys(ROLE_LABELS) as WorkbenchAssetRole[]).map((role) =>
              el('option', { text: ROLE_LABELS[role], attrs: { value: role, selected: (file.suggestedRoles[0] ?? '') === role } }),
            ),
          ),
        ),
      ),
    );

    replace(
      bodyHost,
      el('h3', { style: { margin: '0 0 4px' }, text: `Acquired ${candidate.title}` }),
      el('p', { class: 'muted', style: { 'margin-top': '0' }, text: `${files.length} raster image(s) staged from ${candidate.creator}. Map any you want onto game roles, then import. Everything goes through the normal staged import - originals are preserved and provenance is recorded.` }),
      el('div', { style: { 'max-height': '340px', 'overflow-y': 'auto' } }, el('table', { class: 'plan-table' }, el('tbody', {}, ...rows))),
    );
    replace(
      footerHost,
      button('Cancel', () => { void api.post('/import/discard', { gameId, batchId }).catch(() => undefined); close(); }, { class: 'btn' }),
      button(`Import ${files.length} sprite${files.length === 1 ? '' : 's'}`, () => void commit(), { class: 'btn btn--primary' }),
    );

    async function commit(): Promise<void> {
      try {
        await api.post('/import/commit', {
          gameId,
          batchId,
          selections: files.map((file) => {
            const role = selections.get(file.stagingId);
            return { stagingId: file.stagingId, ...(role ? { role } : {}) };
          }),
          provenance,
        });
        toast(`Imported ${candidate.title}. Provenance recorded as ${candidate.rights.license}.`, 'ok');
        close();
        await refreshCurrent();
        await openProject(gameId!);
      } catch (error) {
        toast(errorText(error), 'err');
      }
    }
  }

  replace(
    bodyHost,
    el('p', { class: 'muted', style: { 'margin-top': '0' } }, project
      ? `Project open: ${project.project.displayName} (${project.project.presetId}). Pick a coherent pack; its sprites are staged into this project through the normal import.`
      : 'No project open. Create a game first, then reopen this to acquire packs into it.'),
    el(
      'div',
      { class: 'row row--wrap', style: { gap: '6px', 'margin-bottom': '10px' } },
      ...providers.map((provider) =>
        el('span', { class: 'badge', title: provider.homepage, text: `${provider.title} · ${provider.online ? 'reachable' : 'offline'} · ${provider.candidateCount} packs` }),
      ),
    ),
    el('div', { class: 'seeds' }, ...candidates.map((candidate) => candidateCard(candidate, gameId ? acquire : null))),
  );
  replace(footerHost, el('span', { class: 'faint', text: project ? `Downloads are copied into games/${project.project.gameId}/` : 'No project open' }));
}
