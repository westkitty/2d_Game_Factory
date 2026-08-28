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
import type {
  PackMatch,
  RoleCoverageEntry,
  SourceCandidate,
  SourceProviderInfo,
  SpriteRequirementProfile,
  RightsStatus,
} from '../../server/sources/types.ts';
import * as api from '../api.ts';

interface Recommendation {
  readonly profile: SpriteRequirementProfile;
  readonly matches: readonly PackMatch[];
  readonly uncovered: readonly WorkbenchAssetRole[];
}

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

const COVERAGE_LABEL: Readonly<Record<RoleCoverageEntry['state'], string>> = {
  covered: '✓',
  partial: '~',
  fallback: 'generated',
  'not-relevant': '·',
};

function roleCoverageGrid(entries: readonly RoleCoverageEntry[]): HTMLElement {
  return el(
    'div',
    { style: { display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(120px, 1fr))', gap: '3px 10px', 'font-size': '11px', 'margin-top': '6px' } },
    ...entries.map((entry) =>
      el(
        'div',
        { class: 'row', style: { gap: '5px', justifyContent: 'space-between' } },
        el('span', { class: entry.importance === 'required' ? '' : 'faint', text: ROLE_LABELS[entry.role] }),
        el('span', {
          style: { color: entry.state === 'covered' ? 'var(--accent)' : entry.state === 'partial' ? 'var(--warn)' : 'var(--text-faint)', 'font-family': 'var(--mono)' },
          text: COVERAGE_LABEL[entry.state],
        }),
      ),
    ),
  );
}

function matchCard(match: PackMatch, onAcquire: (c: SourceCandidate) => void, onReskin?: (c: SourceCandidate) => void): HTMLElement {
  const c = match.candidate;
  const usable = !match.blockedReason && rightsUsable(c.rights.status);
  return el(
    'div',
    { class: 'seed', attrs: { 'data-pack-id': c.packId } },
    el(
      'div',
      { class: 'row row--wrap', style: { gap: '6px' } },
      el('span', { class: RIGHTS_CLASS[c.rights.status], text: RIGHTS_LABEL[c.rights.status] }),
      el('span', { class: 'badge', text: `${match.score}% fit` }),
      el('span', { class: 'badge', text: `${match.coveredRoles}/${match.totalRoles} roles` }),
      c.camera ? el('span', { class: 'badge', text: c.camera }) : null,
      c.hasAnimationFrames ? el('span', { class: 'badge', text: 'frames' }) : null,
    ),
    el('div', { class: 'seed__title', text: c.title }),
    el('div', { class: 'coverage' }, el('div', { class: 'coverage__fill', style: { width: `${match.score}%` } })),
    match.blockedReason
      ? el('div', { class: 'errbox', text: `Blocked: ${match.blockedReason}.` })
      : el(
          'div',
          {},
          el('div', { class: 'faint', style: { 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }, text: 'Why this fits' }),
          el('ul', { style: { margin: '3px 0 0', 'padding-left': '16px', 'font-size': '12px' } }, ...match.reasons.map((reason) => el('li', { text: reason }))),
          roleCoverageGrid(match.roleCoverage),
          match.caveats.length > 0
            ? el('ul', { class: 'faint', style: { margin: '6px 0 0', 'padding-left': '16px', 'font-size': '11px' } }, ...match.caveats.map((caveat) => el('li', { text: caveat })))
            : null,
        ),
    el('div', { class: 'seed__limits' }, `${c.creator} · ${c.rights.licenseName} · ${c.fileCount ?? '?'} PNG files`, el('div', { class: 'mono faint', style: { 'font-size': '10px', 'margin-top': '3px' }, text: c.rights.evidenceUrl })),
    el(
      'div',
      { class: 'row', style: { gap: '6px' } },
      button(usable ? 'Acquire pack' : 'Unavailable', () => onAcquire(c), { class: usable ? 'btn btn--primary' : 'btn', disabled: !usable }),
      usable && onReskin && match.totalRequired > 0 && match.coveredRequired === match.totalRequired
        ? button('Preview this look', () => onReskin(c), { class: 'btn', title: 'Acquire and audition this pack as a coherent visual treatment' })
        : null,
    ),
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

  /** Object URLs minted for audition thumbnails; revoked when the modal closes. */
  const auditionUrls: string[] = [];

  const close = openModal({
    wide: true,
    title: 'Find free sprites',
    body: bodyHost,
    footer: [footerHost],
    onClose: () => {
      for (const url of auditionUrls) URL.revokeObjectURL(url);
      auditionUrls.length = 0;
    },
  });

  replace(
    bodyHost,
    el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'The factory looks for coherent, free-to-use raster sprite packs that fit the game you are making. Each pack’s licence and provenance is shown before anything is downloaded, and every accepted sprite is copied into the project so the finished game needs no network to run.'),
    el('div', { class: 'empty', attrs: { 'data-testid': 'ffs-loading' }, text: 'Checking configured providers…' }),
  );

  interface VaultEntry {
    readonly sha256: string;
    readonly providerId: string;
    readonly packId: string;
    readonly title: string;
    readonly creator: string;
    readonly sourcePage: string;
    readonly byteSize: number;
    readonly fileCount: number;
    readonly acquiredAt: string;
    readonly freshness: RightsStatus;
    readonly bytesPresent: boolean;
  }

  let providers: readonly SourceProviderInfo[] = [];
  let candidates: readonly SourceCandidate[] = [];
  let vault: readonly VaultEntry[] = [];
  try {
    const [p, c, v] = await Promise.all([
      api.get<{ providers: readonly SourceProviderInfo[] }>('/sources/providers'),
      api.get<{ candidates: readonly SourceCandidate[] }>('/sources/catalog'),
      api.get<{ packs: readonly VaultEntry[] }>('/sources/vault').catch(() => ({ packs: [] as readonly VaultEntry[] })),
    ]);
    providers = p.providers;
    candidates = c.candidates;
    vault = v.packs;
  } catch {
    providers = [];
    candidates = [];
    vault = [];
  }

  const vaultByPack = new Map(vault.map((entry) => [`${entry.providerId}:${entry.packId}`, entry]));
  const inVault = (c: SourceCandidate): VaultEntry | undefined => vaultByPack.get(`${c.providerId}:${c.packId}`);

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

  interface StagedAuditionFile {
    readonly stagingId: string;
    readonly displayName: string;
    readonly suggestedRoles: readonly WorkbenchAssetRole[];
    readonly analysis: { readonly width: number; readonly height: number };
  }
  interface ReskinProposalLite {
    readonly assignments: readonly { readonly role: WorkbenchAssetRole; readonly stagingId: string; readonly basis: string }[];
    readonly fallbackRoles: readonly WorkbenchAssetRole[];
  }

  async function acquire(candidate: SourceCandidate, asLook: boolean): Promise<void> {
    if (!gameId) return;
    try {
      const { jobId } = await api.post<{ jobId: string }>('/sources/acquire', {
        gameId,
        providerId: candidate.providerId,
        packId: candidate.packId,
        ...(asLook ? { reskin: true } : {}),
      });
      const job = await awaitJob(jobId, `Acquiring ${candidate.title}`);
      if (job.status !== 'completed') {
        toast(job.error ?? 'Acquisition failed.', 'err');
        return;
      }
      const outcome = job.result as
        | {
            result: { batchId: string; staged: number; ignored: number; svgOnly: boolean; provenance: unknown };
            plan: { files: readonly StagedAuditionFile[]; ignored: readonly { displayName: string; reason: string }[] };
            reskinProposal?: ReskinProposalLite;
          }
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
      audition(candidate, outcome.result.batchId, outcome.result.provenance, outcome.plan.files, asLook ? outcome.reskinProposal : undefined);
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  function auditionThumb(batchId: string, file: StagedAuditionFile): HTMLElement {
    const image = el('img', {
      attrs: { alt: file.displayName, loading: 'lazy' },
      style: { width: '56px', height: '56px', 'object-fit': 'contain', 'image-rendering': 'pixelated', background: 'var(--bg-input)', 'border-radius': '3px' },
    });
    void api
      .stagedBlobUrl(gameId!, batchId, file.stagingId)
      .then((url) => {
        auditionUrls.push(url);
        image.src = url;
      })
      .catch(() => { image.alt = 'unreadable'; });
    return image;
  }

  function audition(
    candidate: SourceCandidate,
    batchId: string,
    provenance: unknown,
    files: readonly StagedAuditionFile[],
    reskin: ReskinProposalLite | undefined,
  ): void {
    if (!gameId) return;

    // stagingId -> chosen role ('' = import with no role); accepted flag
    const state = new Map<string, { role: WorkbenchAssetRole | ''; accepted: boolean }>();
    if (reskin) {
      const byRole = new Map(reskin.assignments.map((a) => [a.stagingId, a.role]));
      for (const file of files) {
        const role = byRole.get(file.stagingId);
        state.set(file.stagingId, { role: role ?? '', accepted: role !== undefined });
      }
    } else {
      for (const file of files) {
        const role = file.suggestedRoles[0] ?? '';
        state.set(file.stagingId, { role, accepted: role !== '' });
      }
    }

    const grid = el('div');

    function acceptedCount(): number {
      return [...state.values()].filter((entry) => entry.accepted).length;
    }

    function paintFooter(): void {
      replace(
        footerHost,
        button('Cancel', () => { void api.post('/import/discard', { gameId, batchId }).catch(() => undefined); close(); }, { class: 'btn' }),
        button('Accept all', () => { for (const entry of state.values()) entry.accepted = true; paint(); }, { class: 'btn btn--sm' }),
        button('Reject all', () => { for (const entry of state.values()) entry.accepted = false; paint(); }, { class: 'btn btn--sm' }),
        button(`Import ${acceptedCount()} accepted`, () => void commit(), { class: 'btn btn--primary' }),
      );
    }

    function tile(file: StagedAuditionFile): HTMLElement {
      const entry = state.get(file.stagingId)!;
      const roleSelect = el(
        'select',
        {
          style: { 'font-size': '11px' },
          on: { change: (event) => { entry.role = (event.target as HTMLSelectElement).value as WorkbenchAssetRole | ''; paint(); } },
        },
        el('option', { text: '— no role —', attrs: { value: '', selected: entry.role === '' } }),
        ...(Object.keys(ROLE_LABELS) as WorkbenchAssetRole[]).map((role) =>
          el('option', { text: ROLE_LABELS[role], attrs: { value: role, selected: entry.role === role } }),
        ),
      );
      return el(
        'div',
        {
          style: {
            border: `1px solid ${entry.accepted ? 'var(--accent-dim)' : 'var(--border)'}`,
            'border-radius': 'var(--radius)', padding: '6px', display: 'flex', 'flex-direction': 'column', gap: '4px',
            opacity: entry.accepted ? '1' : '0.5', background: 'var(--bg-panel)', width: '108px',
          },
        },
        el('div', { style: { display: 'grid', 'place-items': 'center' } }, auditionThumb(batchId, file)),
        el('div', { class: 'faint truncate', style: { 'font-size': '10px' }, text: `${file.analysis.width}x${file.analysis.height}` }),
        roleSelect,
        el(
          'label',
          { class: 'row', style: { gap: '4px', 'font-size': '11px' } },
          el('input', {
            attrs: { type: 'checkbox', checked: entry.accepted },
            on: { change: (event) => { entry.accepted = (event.target as HTMLInputElement).checked; paint(); } },
          }),
          el('span', { text: 'use' }),
        ),
      );
    }

    function paint(): void {
      // Group the roleful/accepted files by role; the rest go in "other".
      const byRole = new Map<string, StagedAuditionFile[]>();
      const other: StagedAuditionFile[] = [];
      for (const file of files) {
        const entry = state.get(file.stagingId)!;
        if (entry.role) {
          const bucket = byRole.get(entry.role) ?? [];
          bucket.push(file);
          byRole.set(entry.role, bucket);
        } else if (entry.accepted) {
          other.push(file);
        } else {
          other.push(file);
        }
      }

      const roleSections = [...byRole.entries()].map(([role, group]) =>
        el(
          'div',
          { style: { 'margin-bottom': '10px' } },
          el(
            'div',
            { class: 'row', style: { gap: '8px', 'margin-bottom': '4px' } },
            el('span', { class: 'badge badge--role', text: ROLE_LABELS[role as WorkbenchAssetRole] }),
            el('span', { class: 'faint', style: { 'font-size': '11px' }, text: `${group.length} candidate${group.length === 1 ? '' : 's'} · ${group.filter((f) => state.get(f.stagingId)!.accepted).length} in use` }),
          ),
          el('div', { class: 'row row--wrap', style: { gap: '6px' } }, ...group.map(tile)),
        ),
      );

      const missing = (reskin?.fallbackRoles ?? []).filter((role) => !byRole.has(role));

      replace(
        grid,
        el('div', { class: 'infobox', style: { 'margin-bottom': '10px' } }, reskin
          ? `Auditioning "${candidate.title}" as a coherent look. One sprite is proposed per role; missing roles keep generated art. Confirm, adjust, or reject before anything is imported.`
          : `${files.length} raster image(s) staged from ${candidate.creator}. Everything you accept goes through the normal staged import - originals preserved, provenance recorded as ${candidate.rights.license}.`),
        missing.length > 0
          ? el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-bottom': '8px' }, text: `Generated fallback keeps: ${missing.map((role) => ROLE_LABELS[role]).join(', ')}` })
          : null,
        ...roleSections,
        other.length > 0
          ? el(
              'details',
              {},
              el('summary', { class: 'faint', text: `${other.length} more staged image(s) - assign a role to include one` }),
              el('div', { class: 'row row--wrap', style: { gap: '6px', 'margin-top': '6px', 'max-height': '260px', 'overflow-y': 'auto' } }, ...other.slice(0, 400).map(tile)),
            )
          : null,
      );
      paintFooter();
    }

    replace(bodyHost, el('h3', { style: { margin: '0 0 8px' }, text: reskin ? `Preview: ${candidate.title} as a look` : `Audition: ${candidate.title}` }), grid);
    paint();

    async function commit(): Promise<void> {
      const accepted = files.filter((file) => state.get(file.stagingId)!.accepted);
      if (accepted.length === 0) {
        toast('Nothing accepted - reject the pack or accept at least one sprite.', 'warn');
        return;
      }
      try {
        await api.post('/import/commit', {
          gameId,
          batchId,
          selections: accepted.map((file) => {
            const role = state.get(file.stagingId)!.role;
            return { stagingId: file.stagingId, ...(role ? { role } : {}) };
          }),
          provenance,
        });
        toast(`Imported ${accepted.length} sprite(s) from ${candidate.title}. Provenance: ${candidate.rights.license}.`, 'ok');
        close();
        await refreshCurrent();
        await openProject(gameId!);
      } catch (error) {
        toast(errorText(error), 'err');
      }
    }
  }

  function providerStripEl(): HTMLElement {
    return el(
      'div',
      { class: 'row row--wrap', style: { gap: '6px', 'margin-bottom': '10px' } },
      ...providers.map((provider) =>
        el('span', { class: 'badge', title: provider.homepage, text: `${provider.title} · ${provider.online ? 'reachable' : 'offline'} · ${provider.candidateCount} packs` }),
      ),
      vault.length > 0
        ? button(`Local vault · ${vault.length}`, () => showVault(), { class: 'btn btn--sm', title: 'Packs already acquired and verified locally - reused without re-downloading' })
        : null,
    );
  }

  function vaultRowActions(entry: VaultEntry): HTMLElement {
    return el(
      'div',
      { class: 'row', style: { gap: '6px' } },
      button('Re-verify', () => void reverify(entry.sha256), { class: 'btn btn--sm', title: 'Re-check the recorded licence against the current policy' }),
      button('Remove', () => void removeVault(entry.sha256), { class: 'btn btn--sm btn--danger', title: 'Delete the cached bytes. Existing games keep their own copies and are unaffected.' }),
    );
  }

  async function reverify(sha256: string): Promise<void> {
    try {
      const { pack } = await api.post<{ pack: VaultEntry }>('/sources/vault/reverify', { sha256 });
      vault = vault.map((entry) => (entry.sha256 === sha256 ? pack : entry));
      vaultByPack.set(`${pack.providerId}:${pack.packId}`, pack);
      toast(`Re-verified: ${pack.title} is ${pack.freshness}.`, pack.freshness === 'verified' || pack.freshness === 'attribution-required' ? 'ok' : 'warn');
      showVault();
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  async function removeVault(sha256: string): Promise<void> {
    try {
      await api.post('/sources/vault/remove', { sha256 });
      const gone = vault.find((entry) => entry.sha256 === sha256);
      vault = vault.filter((entry) => entry.sha256 !== sha256);
      if (gone) vaultByPack.delete(`${gone.providerId}:${gone.packId}`);
      toast('Removed from the local vault. No game was affected.', 'ok');
      showVault();
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  function showVault(): void {
    replace(
      bodyHost,
      el('div', { class: 'row', style: { 'margin-bottom': '8px' } }, button('← Back', () => (recommendation ? showRecommendations() : showCatalogue()), { class: 'btn btn--sm' })),
      el('h3', { style: { margin: '0 0 4px' }, text: 'Verified local vault' }),
      el('p', { class: 'muted', style: { 'margin-top': '0', 'font-size': '12px' } }, 'Packs already acquired here, with the licence snapshot taken at acquisition. Re-acquiring one of these is instant and needs no network. This is an authoring cache - deleting an entry never affects a game, which keeps its own local copies.'),
      vault.length === 0
        ? el('div', { class: 'empty', text: 'The vault is empty. Acquire a pack and it is cached here.' })
        : el(
            'div',
            { class: 'seeds' },
            ...vault.map((entry) =>
              el(
                'div',
                { class: 'seed' },
                el(
                  'div',
                  { class: 'row row--wrap', style: { gap: '6px' } },
                  el('span', { class: RIGHTS_CLASS[entry.freshness], text: RIGHTS_LABEL[entry.freshness] }),
                  el('span', { class: 'badge', text: `${(entry.byteSize / 1024).toFixed(0)} KB` }),
                  el('span', { class: 'badge', text: `${entry.fileCount} PNG` }),
                  entry.bytesPresent ? null : el('span', { class: 'badge badge--danger', text: 'bytes missing' }),
                ),
                el('div', { class: 'seed__title', text: entry.title }),
                el('div', { class: 'seed__loop', text: `${entry.creator} · acquired ${entry.acquiredAt.slice(0, 10)}` }),
                el('div', { class: 'mono faint', style: { 'font-size': '10px' }, text: `sha256 ${entry.sha256.slice(0, 16)}…` }),
                el('div', { class: 'mono faint', style: { 'font-size': '10px' }, text: entry.sourcePage }),
                vaultRowActions(entry),
              ),
            ),
          ),
    );
    replace(footerHost, el('span', { class: 'faint', text: `${vault.length} pack(s) cached locally` }));
  }

  // Preset-aware: recommend against the open project (or the chosen preset).
  let recommendation: Recommendation | null = null;
  const presetIdForQuery = project?.project.presetId ?? null;
  if (presetIdForQuery) {
    try {
      recommendation = await api.get<Recommendation>('/sources/recommend', gameId ? { gameId } : { presetId: presetIdForQuery });
    } catch {
      recommendation = null;
    }
  }

  function withVaultNote(candidate: SourceCandidate, card: HTMLElement): HTMLElement {
    const entry = inVault(candidate);
    if (!entry) return card;
    return el(
      'div',
      {},
      card,
      el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '-6px', 'margin-bottom': '6px' }, text: `In local vault (${entry.freshness}) — acquiring is instant and offline.` }),
    );
  }

  function showCatalogue(): void {
    replace(
      bodyHost,
      el('p', { class: 'muted', style: { 'margin-top': '0' } }, 'Every pack in the catalogue. Rights are shown before anything downloads.'),
      providerStripEl(),
      recommendation ? button('← Back to recommendations', () => showRecommendations(), { class: 'btn btn--sm' }) : null,
      el('div', { class: 'seeds', style: { 'margin-top': '10px' } }, ...candidates.map((candidate) => withVaultNote(candidate, candidateCard(candidate, gameId ? (c) => void acquire(c, false) : null)))),
    );
  }

  function showRecommendations(): void {
    if (!recommendation) {
      showCatalogue();
      return;
    }
    const { profile, matches, uncovered } = recommendation;
    const usableMatches = matches.filter((match) => !match.blockedReason);
    const blocked = matches.filter((match) => match.blockedReason);

    replace(
      bodyHost,
      el('p', { class: 'muted', style: { 'margin-top': '0' } }, project
        ? `We know what ${project.project.displayName} needs. Best-fitting coherent packs first - each acquired sprite goes through the normal staged import.`
        : `Best-fitting packs for a ${profile.presetDisplayName}.`),
      providerStripEl(),
      el(
        'div',
        { class: 'infobox' },
        el('strong', { text: `${profile.presetDisplayName} visual requirements` }),
        el('div', {
          style: { 'font-size': '12px', 'margin-top': '3px' },
          text: `${profile.camera === 'side' ? 'side-view' : profile.camera} camera · ${profile.roles.length} roles${profile.animationUseful ? ' · movement animation useful' : ''}${profile.tileBased ? ' · tile-based' : ''}${profile.derivedFromKit ? '' : ' · derived from controller family'}`,
        }),
        uncovered.length > 0
          ? el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '4px' }, text: `No pack covers: ${uncovered.map((role) => ROLE_LABELS[role]).join(', ')} — these use generated fallback art.` })
          : null,
      ),
      el('div', { class: 'seeds' }, ...usableMatches.map((match) => matchCard(match, gameId ? (c) => void acquire(c, false) : () => toast('Open a project to acquire packs.', 'warn'), gameId ? (c) => void acquire(c, true) : undefined))),
      blocked.length > 0
        ? el('details', { style: { 'margin-top': '10px' } }, el('summary', { class: 'faint', text: `${blocked.length} pack(s) excluded by licence/format` }), el('div', { class: 'seeds', style: { 'margin-top': '8px' } }, ...blocked.map((match) => matchCard(match, () => undefined))))
        : null,
      el('div', { style: { 'margin-top': '12px' } }, button('Show all packs', () => showCatalogue(), { class: 'btn btn--sm' })),
    );
  }

  if (recommendation) showRecommendations();
  else showCatalogue();
  replace(footerHost, el('span', { class: 'faint', text: project ? `Downloads are copied into games/${project.project.gameId}/` : 'No project open — create a game to acquire packs' }));
}
