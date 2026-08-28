/**
 * The provider registry.
 *
 * A closed list. Adding a provider is one import and one array entry here;
 * there is no dynamic discovery and no way for a request to register one.
 */

import { kenneyProvider } from './kenney.ts';
import { providerInfo, type SourceProvider } from './provider.ts';
import type { SourceCandidate, SourceProviderInfo } from './types.ts';

const PROVIDERS: readonly SourceProvider[] = [kenneyProvider];

export function listProviders(): readonly SourceProvider[] {
  return PROVIDERS;
}

export function getProvider(id: string): SourceProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

/** Every candidate across every provider, rights already evaluated. */
export function allCandidates(now?: number): readonly SourceCandidate[] {
  return PROVIDERS.flatMap((provider) => provider.listCandidates(now));
}

export function findCandidate(providerId: string, packId: string, now?: number): SourceCandidate | undefined {
  return getProvider(providerId)?.getCandidate(packId, now);
}

/** Provider summaries for the entry surface. `probeOnline` is skipped in tests / offline. */
export async function listProviderInfo(options?: { probeOnline?: boolean; fetchImpl?: typeof fetch }): Promise<readonly SourceProviderInfo[]> {
  const probe = options?.probeOnline ?? true;
  return Promise.all(
    PROVIDERS.map(async (provider) => {
      const online = probe ? await provider.online(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : undefined) : false;
      return providerInfo(provider, online);
    }),
  );
}
