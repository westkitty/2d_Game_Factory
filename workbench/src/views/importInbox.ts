/**
 * The Import Inbox (principle P05).
 *
 * Every intake route - one file, many files, a dropped folder, a ZIP - lands
 * in the same staging batch, produces the same plan, and commits through the
 * same transaction. Construct's breadth of entry points is worth copying; its
 * risk (each entry point drifting into its own semantics) is avoided by having
 * exactly one path past `stage`.
 *
 * Nothing enters the project until the user has seen the plan and pressed
 * Import. Duplicates arrive unticked, groups and role suggestions are shown as
 * suggestions, and anything that could not be read is listed with the reason
 * rather than silently dropped.
 */

import { el, button, formatBytes, replace, toast } from '../dom.ts';
import * as api from '../api.ts';
import { analyseFile, mapWithLimit } from '../image/clientImage.ts';
import { openModal } from './modal.ts';
import { errorText } from '../actions.ts';
import { getState, update, type ProjectState } from '../state.ts';
import { WORKBENCH_ASSET_ROLES, ROLE_LABELS, type ImportPlan, type Provenance, type StagedFile, type WorkbenchAssetRole } from '../../shared/types.ts';

/** Matches the host's cap. Kept in step so a batch is not sent only to be refused. */
const UPLOAD_CONCURRENCY = 3;

interface PendingFile {
  readonly file: File;
  readonly relativePath: string;
}

/** Recursively walks a dropped directory. Chrome-only API, so it is feature-detected and never assumed. */
async function readDirectoryEntry(entry: FileSystemDirectoryEntry, prefix: string, out: PendingFile[], depth = 0): Promise<void> {
  if (depth > 6) return; // a pathological tree is not worth walking forever
  const reader = entry.createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return;
    for (const child of batch) {
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) => (child as FileSystemFileEntry).file(resolve, reject));
        out.push({ file, relativePath: `${prefix}${child.name}` });
      } else if (child.isDirectory) {
        await readDirectoryEntry(child as FileSystemDirectoryEntry, `${prefix}${child.name}/`, out, depth + 1);
      }
    }
  }
}

async function filesFromDataTransfer(transfer: DataTransfer): Promise<PendingFile[]> {
  const out: PendingFile[] = [];
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(transfer.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        out.push({ file, relativePath: entry.name });
      } else if (entry.isDirectory) {
        await readDirectoryEntry(entry as FileSystemDirectoryEntry, `${entry.name}/`, out);
      }
    }
    return out;
  }

  // Browsers without the entry API still give us a flat file list.
  for (const file of Array.from(transfer.files)) out.push({ file, relativePath: file.name });
  return out;
}

export interface ImportInboxOptions {
  readonly gameId: string;
  /** Pre-selects a role for a single-file import - used by the "replace this asset's role" path. */
  readonly defaultRole?: WorkbenchAssetRole;
  readonly title?: string;
  onDone?(assetIds: readonly string[]): void | Promise<void>;
}

export function openImportInbox(options: ImportInboxOptions): void {
  let batchId: string | null = null;
  let plan: ImportPlan | null = null;
  const selected = new Map<string, WorkbenchAssetRole | null>();
  let provenanceKind: Provenance['kind'] = 'project-owned';
  let originalSource = '';
  let license = '';

  const dropzone = el(
    'div',
    { class: 'dropzone', attrs: { tabindex: '0', role: 'button', 'aria-label': 'Drop images, a folder, or a ZIP here' } },
    el('div', { style: { 'font-size': '30px', 'margin-bottom': '8px' }, text: '⬇' }),
    el('div', { style: { 'font-size': '14px', color: 'var(--text)' }, text: 'Drop images, a folder or a ZIP here' }),
    el('div', { style: { 'margin-top': '4px' }, text: 'PNG, JPEG and WebP. Frame numbering in any convention - walk_01, walk-2, walk0003 all group.' }),
  );

  const filePicker = el('input', { attrs: { type: 'file', multiple: 'true', accept: 'image/png,image/jpeg,image/webp,.zip', hidden: 'true' } });
  const folderPicker = el('input', { attrs: { type: 'file', hidden: 'true' } });
  // `webkitdirectory` is not in the standard DOM typings; set it directly.
  folderPicker.setAttribute('webkitdirectory', '');
  folderPicker.setAttribute('directory', '');

  const progress = el('div', { class: 'faint', style: { 'margin-top': '10px', 'min-height': '17px' } });
  const planHost = el('div', { style: { 'margin-top': '14px' } });
  const importButton = button('Import', () => void commit(), { class: 'btn btn--primary', disabled: true });

  async function ensureBatch(): Promise<string> {
    if (batchId) return batchId;
    const result = await api.post<{ batchId: string }>('/import/begin', { gameId: options.gameId });
    batchId = result.batchId;
    return batchId;
  }

  async function intake(pending: readonly PendingFile[]): Promise<void> {
    if (pending.length === 0) return;
    const id = await ensureBatch();
    let done = 0;
    progress.textContent = `Reading ${pending.length} file${pending.length === 1 ? '' : 's'}…`;

    // Bounded concurrency: a dropped folder of hundreds of images must not be
    // decoded all at once (F17). The limit matches the host's own cap.
    await mapWithLimit(pending, UPLOAD_CONCURRENCY, async (entry) => {
      try {
        // Only images get client-side analysis; a ZIP is handed straight over
        // and expanded host-side, where the per-entry limits live.
        const isZip = /\.zip$/i.test(entry.file.name) || entry.file.type === 'application/zip';
        const hints = isZip ? undefined : await analyseFile(entry.file).catch(() => undefined);
        await api.postBytes('/import/file', entry.file, {
          'x-sw2d-batch': id,
          'x-sw2d-name': entry.file.name,
          'x-sw2d-path': entry.relativePath,
          ...(hints ? { 'x-sw2d-hints': JSON.stringify(hints) } : {}),
        });
      } catch (error) {
        toast(`${entry.file.name}: ${errorText(error)}`, 'err');
      } finally {
        done += 1;
        progress.textContent = `Read ${done} of ${pending.length}…`;
      }
    });

    progress.textContent = '';
    await refreshPlan();
  }

  async function refreshPlan(): Promise<void> {
    if (!batchId) return;
    plan = await api.get<ImportPlan>('/import/plan', { gameId: options.gameId, batchId });
    for (const file of plan.files) {
      if (selected.has(file.stagingId)) continue;
      // Duplicates start unticked: importing the same bytes twice is almost
      // never what someone meant, but it is occasionally deliberate, so it is
      // a default, not a prohibition.
      if (file.duplicateOf) continue;
      selected.set(file.stagingId, options.defaultRole ?? file.suggestedRoles[0] ?? null);
    }
    paintPlan();
  }

  function roleSelect(file: StagedFile): HTMLElement {
    const current = selected.get(file.stagingId) ?? null;
    const node = el(
      'select',
      {
        attrs: { 'aria-label': `Role for ${file.displayName}` },
        on: {
          change: (event) => {
            const value = (event.target as HTMLSelectElement).value;
            selected.set(file.stagingId, value === '' ? null : (value as WorkbenchAssetRole));
          },
        },
      },
      el('option', { text: 'no role yet', attrs: { value: '' } }),
      ...WORKBENCH_ASSET_ROLES.map((role) =>
        el('option', {
          text: file.suggestedRoles.includes(role) ? `${ROLE_LABELS[role]} (suggested)` : ROLE_LABELS[role],
          attrs: { value: role, selected: role === current },
        }),
      ),
    );
    node.value = current ?? '';
    node.disabled = !selected.has(file.stagingId);
    return node;
  }

  function paintPlan(): void {
    if (!plan) return;
    const rows = plan.files.map((file) => {
      const checkbox = el('input', {
        attrs: { type: 'checkbox', checked: selected.has(file.stagingId), 'aria-label': `Import ${file.displayName}` },
        on: {
          change: (event) => {
            if ((event.target as HTMLInputElement).checked) selected.set(file.stagingId, file.suggestedRoles[0] ?? null);
            else selected.delete(file.stagingId);
            paintPlan();
          },
        },
      });
      const thumb = el('img', { class: 'plan-thumb', attrs: { alt: '', loading: 'lazy' } });
      return el(
        'tr',
        { attrs: { 'data-duplicate': file.duplicateOf !== undefined } },
        el('td', {}, checkbox),
        el('td', {}, thumb),
        el(
          'td',
          {},
          el('div', { class: 'truncate', text: file.displayName, title: file.sourceRelativePath }),
          el(
            'div',
            { class: 'faint', style: { 'font-size': '11px' } },
            `${file.analysis.width}x${file.analysis.height} · ${formatBytes(file.analysis.byteSize)}${file.analysis.hasAlpha ? ' · transparent' : ''}${file.analysis.pixelArtLikely ? ' · pixel art' : ''}`,
          ),
          file.duplicateOf ? el('div', { class: 'badge badge--danger', text: `duplicate: ${file.duplicateOf}` }) : null,
        ),
        el('td', {}, file.group ? el('span', { class: 'badge', text: file.frameIndex !== undefined ? `${file.group} #${file.frameIndex}` : file.group }) : el('span', { class: 'faint', text: '—' })),
        el('td', {}, roleSelect(file)),
      );
    });

    const groupsNote =
      plan.groups.length > 0
        ? el(
            'div',
            { class: 'infobox' },
            el('strong', { text: `${plan.groups.length} likely frame group${plan.groups.length === 1 ? '' : 's'} detected` }),
            el('div', { text: plan.groups.map((group) => `${group.name} (${group.stagingIds.length} frames)`).join(' · ') }),
            el('div', { class: 'faint', style: { 'margin-top': '4px' }, text: 'Groups are recorded with the assets. The current runtime draws one representative frame per role - pick which in the Asset Lab.' }),
          )
        : null;

    replace(
      planHost,
      ...plan.warnings.map((warning) => el('div', { class: 'warnbox', text: warning })),
      groupsNote,
      plan.files.length === 0
        ? el('div', { class: 'empty', text: 'Nothing readable yet.' })
        : el(
            'div',
            { style: { 'max-height': '340px', overflow: 'auto', border: '1px solid var(--border)', 'border-radius': 'var(--radius)' } },
            el(
              'table',
              { class: 'plan-table' },
              el(
                'thead',
                {},
                el(
                  'tr',
                  {},
                  el('th', { text: '' }),
                  el('th', { text: '' }),
                  el('th', { text: 'File' }),
                  el('th', { text: 'Group' }),
                  el('th', { text: 'Role' }),
                ),
              ),
              el('tbody', {}, ...rows),
            ),
          ),
      plan.ignored.length > 0
        ? el(
            'details',
            { style: { 'margin-top': '10px' } },
            el('summary', { class: 'muted', text: `${plan.ignored.length} file(s) not imported - reasons` }),
            el('ul', { style: { 'padding-left': '18px', 'font-size': '12px' } }, ...plan.ignored.map((entry) => el('li', {}, el('span', { class: 'mono', text: entry.displayName }), ' — ', entry.reason))),
          )
        : null,
    );

    importButton.disabled = selected.size === 0;
    importButton.textContent = selected.size === 0 ? 'Import' : `Import ${selected.size} asset${selected.size === 1 ? '' : 's'}`;

    // Thumbnails last and lazily, from the staged analysis we already have -
    // no extra decode pass over the whole batch.
    void paintThumbnails(rows);
  }

  async function paintThumbnails(rows: readonly HTMLElement[]): Promise<void> {
    if (!plan) return;
    await mapWithLimit(plan.files, UPLOAD_CONCURRENCY, async (file, index) => {
      const image = rows[index]?.querySelector('img');
      if (!image) return;
      const source = pendingBlobs.get(file.stagingId) ?? pendingByName.get(file.displayName);
      if (!source) return;
      const url = URL.createObjectURL(source);
      image.src = url;
      image.onload = () => URL.revokeObjectURL(url);
    });
  }

  // Blobs held only long enough to draw plan thumbnails; cleared on close.
  const pendingBlobs = new Map<string, Blob>();
  const pendingByName = new Map<string, Blob>();

  async function commit(): Promise<void> {
    if (!batchId || selected.size === 0) return;
    const provenance: Provenance = {
      kind: provenanceKind,
      modificationStatus: provenanceKind === 'generated' ? 'generated' : 'unmodified',
      ...(originalSource ? { originalSource } : {}),
      ...(license ? { license } : {}),
      ...(provenanceKind === 'third-party-known' ? { attributionRequired: true } : {}),
    };
    importButton.disabled = true;
    try {
      const result = await api.post<{ assetIds: readonly string[]; state: ProjectState }>('/import/commit', {
        gameId: options.gameId,
        batchId,
        selections: [...selected.entries()].map(([stagingId, role]) => ({ stagingId, ...(role ? { role } : {}) })),
        provenance,
      });
      // Apply the project state the commit returned here rather than leaving
      // it to each caller's `onDone`. Every intake route ends in this one
      // function, so doing it here is what makes "the library shows what you
      // just imported" true no matter which button opened the inbox.
      update({ current: result.state, selectedAssetId: result.assetIds[0] ?? getState().selectedAssetId });
      close();
      toast(`Imported ${result.assetIds.length} asset${result.assetIds.length === 1 ? '' : 's'}.`, 'ok');
      await options.onDone?.(result.assetIds);
    } catch (error) {
      importButton.disabled = false;
      toast(errorText(error), 'err');
    }
  }

  const provenanceSelect = el(
    'select',
    {
      attrs: { 'aria-label': 'Where did this come from?' },
      on: {
        change: (event) => {
          provenanceKind = (event.target as HTMLSelectElement).value as Provenance['kind'];
          paintProvenance();
        },
      },
    },
    el('option', { text: 'I made or own this', attrs: { value: 'project-owned' } }),
    el('option', { text: 'Generated for this project', attrs: { value: 'generated' } }),
    el('option', { text: 'Third-party, source and licence known', attrs: { value: 'third-party-known' } }),
    el('option', { text: 'Source or licence unknown', attrs: { value: 'unknown' } }),
    el('option', { text: 'Reference only — do not ship these pixels', attrs: { value: 'reference-only' } }),
  );

  const provenanceDetail = el('div');

  function paintProvenance(): void {
    if (provenanceKind === 'third-party-known') {
      replace(
        provenanceDetail,
        el('div', { class: 'row', style: { 'margin-top': '8px' } },
          el('label', { class: 'grow' }, el('span', { class: 'faint', text: 'Source' }), el('input', {
            attrs: { type: 'text', placeholder: 'https://…' },
            on: { input: (event) => { originalSource = (event.target as HTMLInputElement).value; } },
          })),
          el('label', { class: 'grow' }, el('span', { class: 'faint', text: 'Licence' }), el('input', {
            attrs: { type: 'text', placeholder: 'CC-BY-4.0' },
            on: { input: (event) => { license = (event.target as HTMLInputElement).value; } },
          })),
        ),
      );
      return;
    }
    if (provenanceKind === 'unknown') {
      replace(provenanceDetail, el('div', { class: 'warnbox', text: 'Recorded as pending. These assets will work in the game and in preview, but Pack will refuse to produce a release until you resolve them. That gate is deliberate.' }));
      return;
    }
    if (provenanceKind === 'reference-only') {
      replace(provenanceDetail, el('div', { class: 'infobox', text: 'These pixels stay in .sw2d/ and never reach the game. You still get the palette and can generate art from it - useful when the image is inspiration rather than something you can ship.' }));
      return;
    }
    replace(provenanceDetail);
  }

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dropzone--over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--over'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dropzone--over');
    if (!event.dataTransfer) return;
    void filesFromDataTransfer(event.dataTransfer).then((files) => {
      for (const entry of files) pendingByName.set(entry.file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), entry.file);
      return intake(files);
    });
  });
  dropzone.addEventListener('click', () => filePicker.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      filePicker.click();
    }
  });

  filePicker.addEventListener('change', () => {
    const files = Array.from(filePicker.files ?? []).map((file) => ({ file, relativePath: file.name }));
    for (const entry of files) pendingByName.set(entry.file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), entry.file);
    void intake(files);
    filePicker.value = '';
  });
  folderPicker.addEventListener('change', () => {
    const files = Array.from(folderPicker.files ?? []).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    for (const entry of files) pendingByName.set(entry.file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), entry.file);
    void intake(files);
    folderPicker.value = '';
  });

  const close = openModal({
    wide: true,
    title: options.title ?? 'Import assets',
    body: el(
      'div',
      {},
      dropzone,
      el(
        'div',
        { class: 'row', style: { 'margin-top': '10px' } },
        button('Choose files…', () => filePicker.click(), { class: 'btn btn--sm' }),
        button('Choose a folder…', () => folderPicker.click(), { class: 'btn btn--sm' }),
        filePicker,
        folderPicker,
        el('div', { class: 'grow' }),
        el('span', { class: 'faint', text: 'A ZIP is expanded here, with per-entry and total size limits.' }),
      ),
      progress,
      el(
        'div',
        { style: { 'margin-top': '14px' } },
        el('label', { class: 'field' }, el('span', { text: 'Where did this come from?' }), provenanceSelect),
        provenanceDetail,
      ),
      planHost,
    ),
    footer: [importButton],
    onClose: () => {
      pendingBlobs.clear();
      pendingByName.clear();
      if (batchId) void api.post('/import/discard', { gameId: options.gameId, batchId }).catch(() => undefined);
    },
  });

  paintProvenance();
}
