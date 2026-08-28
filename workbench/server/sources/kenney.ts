/**
 * The Kenney provider.
 *
 * Kenney game assets are published under CC0 1.0 with no attribution
 * obligation ("Attribution is not required" - https://kenney.nl/support), and
 * they ship as coherent, single-style PNG packs, which is exactly what this
 * workflow wants. Packs are fetched from `kenney.nl` only, through the narrow
 * allowlisted net path, and only from the curated catalogue - there is no way
 * to point this at an arbitrary Kenney URL, let alone an arbitrary host.
 */

import { MAX_PACK_DOWNLOAD_BYTES, PACK_DOWNLOAD_TIMEOUT_MS } from './limits.ts';
import { kenneyCatalogRows, CATALOG_VERIFIED_AT } from './catalog.ts';
import { evaluateRights } from './rights.ts';
import { providerGet, providerOnline } from './net.ts';
import type { DownloadedPack, ProviderNetOptions, SourceProvider } from './provider.ts';
import type { SourceCandidate } from './types.ts';

const ZIP_CONTENT_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'binary/octet-stream',
  '', // some CDNs omit it; the bytes are checked by the caller regardless
]);

export const kenneyProvider: SourceProvider = {
  id: 'kenney',
  title: 'Kenney',
  homepage: 'https://kenney.nl',
  licenseSummary: 'CC0 1.0 - public domain, no attribution required. Coherent single-style PNG packs.',

  listCandidates(now?: number): readonly SourceCandidate[] {
    return kenneyCatalogRows().map((row) => {
      const { licenseId, licenseName, licenseEvidenceUrl, ...rest } = row;
      return {
        ...rest,
        rights: evaluateRights(
          {
            license: licenseId,
            licenseName,
            evidenceUrl: licenseEvidenceUrl,
            verifiedAt: CATALOG_VERIFIED_AT,
            attributionRequired: false,
          },
          now,
        ),
      };
    });
  },

  getCandidate(packId: string, now?: number): SourceCandidate | undefined {
    return this.listCandidates(now).find((candidate) => candidate.packId === packId);
  },

  async download(packId: string, options: ProviderNetOptions = {}): Promise<DownloadedPack> {
    const candidate = this.getCandidate(packId);
    if (!candidate) throw new Error(`Unknown Kenney pack "${packId}".`);
    const result = await providerGet('kenney', candidate.acquisitionUrl, {
      maxBytes: MAX_PACK_DOWNLOAD_BYTES,
      timeoutMs: PACK_DOWNLOAD_TIMEOUT_MS,
      accept: 'application/zip,application/octet-stream',
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.lookupImpl ? { lookupImpl: options.lookupImpl } : {}),
    });
    const normalizedType = result.contentType.split(';')[0]?.trim() ?? '';
    if (!ZIP_CONTENT_TYPES.has(normalizedType) && !normalizedType.includes('zip')) {
      throw new Error(`Kenney returned content-type "${result.contentType}", which is not an archive.`);
    }
    return { bytes: result.bytes, contentType: result.contentType, sourcePage: candidate.sourcePage, finalUrl: result.finalUrl };
  },

  online(options?: { fetchImpl?: typeof fetch }): Promise<boolean> {
    return providerOnline('kenney', options);
  },
};
