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
  PackMatch,
  ProfileRole,
  RightsEvidence,
  RightsStatus,
  RoleCoverageEntry,
  RoleCoverageState,
  RoleImportance,
  SourceCandidate,
  SourceProviderInfo,
  SpriteRequirementProfile,
} from './types.ts';
export { deriveProfile, cameraForControllers } from './requirements.ts';
export { rankPacks, matchPack, uncoveredRoles } from './matching.ts';
export { recommendForPreset, type Recommendation } from './recommend.ts';
export { whatCanIMakeWith, type ReverseDiscovery, type PresetSuggestion, type MatchLevel } from './reverse.ts';
export { proposeReskin, type ReskinAssignment, type ReskinProposal, type StagedFileLite } from './reskin.ts';
export {
  listVault,
  vaultLookup,
  vaultStore,
  reverifyVault,
  removeFromVault,
  clearVault,
  vaultFreshness,
  vaultByteTotal,
  VAULT_ROOT,
  type VaultPackRecord,
  type VaultEntryView,
  type ReverifyOutcome,
} from './vault.ts';
export {
  evaluateRights,
  acceptableLicenses,
  rightsAllowShipping,
  rightsAllowExistingUse,
  rightsAllowNewAcquisition,
  rightsAllowUse,
  VERIFICATION_FRESHNESS_DAYS,
} from './rights.ts';
export { SourceNetworkError, PROVIDER_HOST_ALLOWLIST, providerHosts, isDisallowedAddress, providerGet, providerOnline } from './net.ts';
export { listProviders, getProvider, allCandidates, findCandidate, listProviderInfo } from './registry.ts';
export { acquirePack, type AcquireInput, type AcquireOutcome } from './acquire.ts';
export type { SourceProvider, DownloadedPack, ProviderNetOptions } from './provider.ts';
export { CATALOG_VERIFIED_AT } from './catalog.ts';
