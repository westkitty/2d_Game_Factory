/**
 * Acquisition: a chosen pack's bytes -> the canonical import pipeline.
 *
 * There is no second importer. A downloaded pack is verified for rights,
 * fetched through the narrow net path, hashed, and handed to the same
 * `beginBatch` / `stagePack` / `buildPlan` / `commitImport` flow local folder
 * and ZIP imports use. Everything downstream - analysis, palette, duplicate
 * detection, frame grouping, provenance, immutable originals - is inherited,
 * not re-implemented.
 */

import { sha256Hex } from '../assetStore.ts';
import { beginBatch, buildPlan, discardBatch, stagePack } from '../importService.ts';
import { looksLikeZip } from '../zip.ts';
import { SecurityError } from '../security.ts';
import type { ImportPlan } from '../../shared/types.ts';
import { findCandidate, getProvider } from './registry.ts';
import { rightsAllowUse } from './rights.ts';
import type { AcquisitionResult } from './types.ts';
import type { ProviderNetOptions } from './provider.ts';

export interface AcquireInput {
  readonly gameId: string;
  readonly providerId: string;
  readonly packId: string;
  readonly net?: ProviderNetOptions;
  /** Injectable clock for freshness evaluation in tests. */
  readonly now?: number;
}

export interface AcquireOutcome {
  readonly result: AcquisitionResult;
  readonly plan: ImportPlan;
}

/**
 * Downloads and stages one pack. Does not commit - the caller reviews the
 * plan and commits through `/import/commit` with the returned provenance, so
 * the user still sees and can correct role mapping before anything lands.
 */
export async function acquirePack(input: AcquireInput): Promise<AcquireOutcome> {
  const provider = getProvider(input.providerId);
  if (!provider) throw new SecurityError(404, `Unknown source provider "${input.providerId}".`);

  const candidate = findCandidate(input.providerId, input.packId, input.now);
  if (!candidate) throw new SecurityError(404, `Provider "${input.providerId}" has no pack "${input.packId}".`);

  if (!rightsAllowUse(candidate.rights)) {
    throw new SecurityError(
      422,
      candidate.rights.status === 'unsupported-license'
        ? `"${candidate.title}" is under ${candidate.rights.license}, which is not on the accepted-licence list. It cannot be used.`
        : `"${candidate.title}" has ${candidate.rights.status} rights and cannot be used until that is resolved.`,
    );
  }

  const downloaded = await provider.download(input.packId, input.net);
  if (!looksLikeZip(downloaded.bytes)) {
    throw new SecurityError(502, `"${candidate.title}" did not download as a ZIP archive.`);
  }

  const sha256 = sha256Hex(downloaded.bytes);
  const batchId = beginBatch(input.gameId);
  try {
    const staged = stagePack(batchId, downloaded.bytes, `${input.providerId}_${input.packId}.zip`);
    const svgOnly = staged.staged === 0 && staged.svgSkipped > 0;
    const plan = buildPlan(input.gameId, batchId);

    const result: AcquisitionResult = {
      providerId: input.providerId,
      packId: input.packId,
      batchId,
      staged: staged.staged,
      ignored: staged.ignored,
      svgOnly,
      sha256,
      byteSize: downloaded.bytes.byteLength,
      provenance: {
        kind: 'third-party-known',
        originalSource: candidate.sourcePage,
        license: candidate.rights.license,
        attributionRequired: candidate.rights.attributionRequired,
        modificationStatus: 'unmodified',
      },
    };
    return { result, plan };
  } catch (error) {
    // A failed stage must not leave a half-populated batch behind.
    discardBatch(input.gameId, batchId);
    throw error;
  }
}
