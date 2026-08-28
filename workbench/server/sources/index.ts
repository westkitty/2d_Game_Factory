/**
 * Authoring-time free-sprite sourcing.
 *
 * Public surface for the API layer and the requirement engine. Runtime games
 * never import from here - this is entirely authoring-side, and it is the only
 * part of the workbench that makes an outbound request.
 */

export type {
  AcquisitionResult,
  CameraPerspective,
  NominalTileSize,
  RightsEvidence,
  RightsStatus,
  SourceCandidate,
  SourceProviderInfo,
} from './types.ts';
export { evaluateRights, acceptableLicenses, rightsAllowShipping, rightsAllowUse, VERIFICATION_FRESHNESS_DAYS } from './rights.ts';
export { SourceNetworkError, PROVIDER_HOST_ALLOWLIST, providerHosts, isDisallowedAddress, providerGet, providerOnline } from './net.ts';
export { listProviders, getProvider, allCandidates, findCandidate, listProviderInfo } from './registry.ts';
export { acquirePack, type AcquireInput, type AcquireOutcome } from './acquire.ts';
export type { SourceProvider, DownloadedPack, ProviderNetOptions } from './provider.ts';
export { CATALOG_VERIFIED_AT } from './catalog.ts';
