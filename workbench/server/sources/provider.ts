/**
 * The source-provider seam.
 *
 * Every provider is the same small surface: list/get normalized candidates,
 * download one pack's raw bytes through the narrow net path, and report
 * whether its host is reachable. Requirement matching, audition, the vault and
 * reverse discovery all consume `SourceCandidate` and never a provider
 * directly, so a second provider is a new file here and one registry line -
 * not a change to the workflow.
 */

import type { SourceCandidate, SourceProviderInfo } from './types.ts';

export interface ProviderNetOptions {
  readonly fetchImpl?: typeof fetch;
  readonly lookupImpl?: (host: string) => Promise<readonly { address: string }[]>;
}

export interface DownloadedPack {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly sourcePage: string;
  readonly finalUrl: string;
}

export interface SourceProvider {
  readonly id: string;
  readonly title: string;
  readonly homepage: string;
  readonly licenseSummary: string;
  /** Normalized candidates, rights already evaluated. `now` is injectable for freshness tests. */
  listCandidates(now?: number): readonly SourceCandidate[];
  getCandidate(packId: string, now?: number): SourceCandidate | undefined;
  /** Raw pack bytes via the narrow, allowlisted, bounded net path. */
  download(packId: string, options?: ProviderNetOptions): Promise<DownloadedPack>;
  online(options?: { fetchImpl?: typeof fetch }): Promise<boolean>;
}

export function providerInfo(provider: SourceProvider, online: boolean, now?: number): SourceProviderInfo {
  return {
    id: provider.id,
    title: provider.title,
    homepage: provider.homepage,
    licenseSummary: provider.licenseSummary,
    online,
    candidateCount: provider.listCandidates(now).length,
  };
}
