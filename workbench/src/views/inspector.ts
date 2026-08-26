/**
 * The inspector (right pane): asset coverage, the selected asset's details,
 * provenance, and the actions that change what the game actually draws.
 *
 * The Role Mapper at the top is the part that matters most. Section 23 puts it
 * bluntly: "a thumbnail badge that does not change the game is not
 * implementation". So every control here calls an endpoint that rewrites
 * `content/themes/default/theme.json` before it returns, and the panel repaints
 * from the state that call produced.
 */

import { el, button, replace, formatBytes, toast } from '../dom.ts';
import * as api from '../api.ts';
import { getState, selectedAsset, subscribe, update, type AppState } from '../state.ts';
import { assignRole, deleteAsset, renameAsset, setProvenance, refreshCurrent } from '../actions.ts';
import { reimportAsset } from './assetLab.ts';
import { openImportInbox } from './importInbox.ts';
import { thumbnailFor } from '../image/clientImage.ts';
import { ROLE_LABELS, type AssetRecord, type Provenance, type RoleAssignment } from '../../shared/types.ts';

const PROVENANCE_LABELS: Readonly<Record<Provenance['kind'], string>> = {
  'project-owned': 'I made or own this',
  generated: 'Generated for this project',
  'third-party-known': 'Third-party, source and licence known',
  unknown: 'Source or licence unknown',
  'reference-only': 'Reference only — pixels never ship',
};

export function renderInspector(host: HTMLElement): () => void {
  const head = el('div', { class: 'pane__head' }, el('span', { class: 'pane__title', text: 'Inspector' }));
  const body = el('div', { class: 'pane__body' });

  function roleRow(assignment: RoleAssignment, state: AppState): HTMLElement {
    const current = state.current!;
    const asset = assignment.assetId ? current.assets.find((candidate) => candidate.id === assignment.assetId) : null;
    const swatch = el('div', { class: 'role-row__swatch' });
    if (asset) {
      const image = el('img', { attrs: { alt: '' } });
      void thumbnailFor(`${asset.id}:${asset.sha256}`, () => api.assetBlob(current.project.gameId, asset.id), 48)
        .then((url) => { image.src = url; })
        .catch(() => undefined);
      replace(swatch, image);
    } else {
      replace(swatch, el('span', { class: 'faint', style: { 'font-size': '9px' }, text: 'auto' }));
    }

    const useful = current.kitUsefulRoles.includes(assignment.role);
    const selected = selectedAsset();

    return el(
      'div',
      { class: `role-row role-row--${assignment.coverage}` },
      swatch,
      el(
        'div',
        { class: 'grow', style: { 'min-width': '0' } },
        el('div', { class: 'role-row__name' }, ROLE_LABELS[assignment.role], useful ? el('span', { class: 'faint', text: ' ·used' }) : null),
        el('div', { class: 'faint truncate', style: { 'font-size': '11px' }, text: asset ? asset.displayName : 'generated from palette' }),
      ),
      asset
        ? button('✕', () => void assignRole(assignment.role, null), { class: 'icon-btn', title: `Revert ${assignment.role} to generated art` })
        : null,
      selected && selected.id !== assignment.assetId
        ? button('←', () => void assignRole(assignment.role, selected.id), { class: 'icon-btn', title: `Use the selected asset for ${assignment.role}` })
        : null,
      button('⇪', () => {
        openImportInbox({
          gameId: current.project.gameId,
          defaultRole: assignment.role,
          title: `Import art for ${ROLE_LABELS[assignment.role]}`,
          onDone: () => refreshCurrent(),
        });
      }, { class: 'icon-btn', title: `Import art straight into ${assignment.role}` }),
    );
  }

  function provenanceSection(asset: AssetRecord): HTMLElement {
    const select = el(
      'select',
      {
        attrs: { 'aria-label': 'Provenance' },
        on: {
          change: (event) => {
            const kind = (event.target as HTMLSelectElement).value as Provenance['kind'];
            void setProvenance(asset.id, {
              kind,
              modificationStatus: asset.kind === 'derived' ? 'modified' : kind === 'generated' ? 'generated' : 'unmodified',
              ...(asset.provenance.originalSource ? { originalSource: asset.provenance.originalSource } : {}),
              ...(asset.provenance.license ? { license: asset.provenance.license } : {}),
            });
          },
        },
      },
      ...(Object.entries(PROVENANCE_LABELS) as [Provenance['kind'], string][]).map(([kind, label]) =>
        el('option', { text: label, attrs: { value: kind, selected: kind === asset.provenance.kind } }),
      ),
    );

    return el(
      'div',
      {},
      el('h3', { class: 'section-title', style: { 'margin-top': '16px' }, text: 'Provenance' }),
      select,
      asset.provenance.kind === 'unknown'
        ? el('div', { class: 'warnbox', style: { 'margin-top': '8px' }, text: 'Recorded as pending. Pack will refuse to build a release until this is resolved.' })
        : null,
      asset.provenance.kind === 'reference-only'
        ? el('div', { class: 'infobox', style: { 'margin-top': '8px' }, text: 'These pixels stay in .sw2d/ and are not copied into the game.' })
        : null,
      asset.provenance.originalSource
        ? el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '6px' }, text: `Source: ${asset.provenance.originalSource}` })
        : null,
    );
  }

  function assetSection(asset: AssetRecord, state: AppState): HTMLElement {
    const current = state.current!;
    const nameInput = el('input', { attrs: { type: 'text', value: asset.displayName, 'aria-label': 'Asset name' } });
    nameInput.addEventListener('change', () => {
      void renameAsset(asset.id, nameInput.value).then(() =>
        // Renaming must be a no-op for everything else: identity is the id.
        toast('Renamed. Roles, derivatives and recipes are unaffected - identity is the asset id, not the name.', 'ok'),
      );
    });

    const replacePicker = el('input', { attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: 'true' } });
    replacePicker.addEventListener('change', () => {
      const file = replacePicker.files?.[0];
      if (file) void reimportAsset(asset.id, file);
      replacePicker.value = '';
    });

    const source = asset.sourceAssetId ? current.assets.find((candidate) => candidate.id === asset.sourceAssetId) : null;
    const derivatives = current.assets.filter((candidate) => candidate.sourceAssetId === asset.id);

    return el(
      'div',
      {},
      el('h3', { class: 'section-title', style: { 'margin-top': '16px' }, text: asset.kind === 'source' ? 'Source asset' : 'Derived asset' }),
      el('label', { class: 'field' }, el('span', { text: 'Name' }), nameInput),
      el(
        'div',
        { class: 'faint', style: { 'font-size': '11px', 'line-height': '1.7' } },
        el('div', {}, el('span', { class: 'mono', text: asset.id })),
        el('div', {}, `${asset.width}x${asset.height} · ${formatBytes(asset.byteSize)} · ${asset.mime}`),
        el('div', {}, el('span', { class: 'mono', text: `sha256 ${asset.sha256.slice(0, 16)}…` })),
        asset.group ? el('div', {}, `frame group: ${asset.group}${asset.frameIndex !== undefined ? ` #${asset.frameIndex}` : ''}`) : null,
      ),
      asset.palette && asset.palette.length > 0
        ? el('div', { class: 'palette', style: { 'margin-top': '8px' } }, ...asset.palette.map((color) => el('div', { class: 'swatch', title: color, style: { background: color } })))
        : null,
      asset.roleAssignments.length > 0
        ? el('div', { class: 'row row--wrap', style: { 'margin-top': '8px' } }, ...asset.roleAssignments.map((role) => el('span', { class: 'badge badge--role', text: role })))
        : null,
      source
        ? el('div', { class: 'infobox', style: { 'margin-top': '10px' } }, el('div', { text: `Derived from "${source.displayName}".` }), el('div', { class: 'faint', text: `${asset.transformRecipe?.steps.length ?? 0} recorded step(s) - rebuildable from the source at any time.` }))
        : null,
      asset.stale
        ? el('div', { class: 'warnbox', style: { 'margin-top': '10px' }, text: 'Its source changed after this was made. Rebuild it to pick up the new pixels.' })
        : null,
      derivatives.length > 0
        ? el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '8px' }, text: `${derivatives.length} derivative(s) hang off this source.` })
        : null,
      el(
        'div',
        { class: 'row row--wrap', style: { 'margin-top': '12px' } },
        asset.kind === 'source'
          ? button('Replace source…', () => replacePicker.click(), { class: 'btn btn--sm', title: 'Reimport: new pixels, same identity, roles and derivatives kept' })
          : button('Rebuild', () => void rebuild(asset.id), { class: 'btn btn--sm', title: 'Replay this recipe against its source' }),
        button('Delete', () => {
          if (derivatives.length > 0 && !window.confirm(`Delete "${asset.displayName}" and its ${derivatives.length} derivative(s)?`)) return;
          void deleteAsset(asset.id);
        }, { class: 'btn btn--sm btn--danger' }),
        replacePicker,
      ),
      provenanceSection(asset),
    );
  }

  async function rebuild(assetId: string): Promise<void> {
    const { current } = getState();
    if (!current) return;
    const result = await api.post<{ rebuilt: readonly string[]; deferredToClient: readonly string[] }>('/assets/rebuild', {
      gameId: current.project.gameId,
      assetIds: [assetId],
    });
    await refreshCurrent();
    toast(result.rebuilt.length > 0 ? 'Rebuilt from its recipe.' : 'This one needs the browser to rebuild - open it in the Asset Lab and save again.', result.rebuilt.length > 0 ? 'ok' : 'warn');
  }

  function paint(state: AppState): void {
    const current = state.current;
    if (!current) {
      replace(body, el('div', { class: 'faint', text: 'No project open.' }));
      return;
    }

    const assignments = current.blueprint.roleAssignments;
    const covered = assignments.filter((entry) => entry.assetId !== null).length;
    const asset = selectedAsset();

    replace(
      body,
      el(
        'div',
        { class: 'row', style: { 'margin-bottom': '6px' } },
        el('h3', { class: 'section-title', style: { margin: '0' }, text: 'Asset coverage' }),
        el('div', { class: 'grow' }),
        el('span', { class: 'faint', style: { 'font-size': '11px' }, text: `${covered}/${assignments.length}` }),
      ),
      el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-bottom': '8px' }, text: 'Roles with no asset use generated art built from your palette - the game is always playable.' }),
      el('div', {}, ...assignments.map((assignment) => roleRow(assignment, state))),
      current.blueprint.palette.length > 0
        ? el(
            'div',
            { style: { 'margin-top': '14px' } },
            el('h3', { class: 'section-title', text: 'Project palette' }),
            el('div', { class: 'palette' }, ...current.blueprint.palette.map((color) => el('div', { class: 'swatch', title: color, style: { background: color } }))),
            el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '6px' }, text: 'Derived from your assets. It drives the theme tokens and every generated fallback.' }),
          )
        : null,
      asset ? assetSection(asset, state) : el('div', { class: 'faint', style: { 'margin-top': '16px' }, text: 'Select an asset to see its details.' }),
    );
  }

  replace(host, head, body);
  paint(getState());
  return subscribe(paint);
}

export { update };
