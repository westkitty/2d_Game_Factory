/**
 * Rights evaluation for sourced packs.
 *
 * The single question this answers: given a licence claim and its evidence,
 * may this pack be used, and does using it create an attribution obligation?
 * The accepted-licence list is read from `resource-policy.json` - there is no
 * second policy here (architectural law: rights are data, governed by the
 * existing policy). "free" and "$0" are never inputs; only the SPDX id and the
 * recorded evidence date are.
 */

import { readFileSync } from 'node:fs';
import { REPO_ROOT, resolveContained } from '../paths.ts';
import type { RightsEvidence, RightsStatus } from './types.ts';

interface ResourcePolicy {
  readonly defaults: { readonly acceptableLicenses: readonly string[] };
}

let cachedAcceptable: readonly string[] | null = null;

/** The accepted-licence list from `resource-policy.json`, read once. */
export function acceptableLicenses(): readonly string[] {
  if (cachedAcceptable) return cachedAcceptable;
  const raw = readFileSync(resolveContained(REPO_ROOT, 'resource-policy.json'), 'utf8');
  const policy = JSON.parse(raw) as ResourcePolicy;
  cachedAcceptable = policy.defaults.acceptableLicenses;
  return cachedAcceptable;
}

/** Licences that carry no attribution obligation even though they are third-party. */
const NO_ATTRIBUTION = new Set(['CC0-1.0', 'Unlicense', '0BSD']);

/**
 * How long recorded licence evidence stays "verified" before it is treated as
 * stale and must be re-checked for a *new* acquisition. Existing games keep
 * whatever snapshot they were built with; staleness never retroactively
 * invalidates shipped work (that rule is enforced in Phase F's vault).
 *
 * `verifiedAt` is always the date a human last reviewed the provider's
 * authoritative rights statement - `CATALOG_VERIFIED_AT` for the catalogue,
 * and the same value copied into every acquired vault entry. It is never a
 * local "I re-stamped this" timestamp; freshness can only be restored by an
 * actual authoritative review that bumps `CATALOG_VERIFIED_AT`.
 */
export const VERIFICATION_FRESHNESS_DAYS = 180;

export interface LicenseInput {
  readonly license: string;
  readonly licenseName: string;
  readonly evidenceUrl: string;
  readonly verifiedAt: string;
  /** Provider's own claim; cross-checked against the licence id below. */
  readonly attributionRequired?: boolean;
  readonly attributionText?: string;
}

function daysSince(iso: string, now: number): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now - then) / 86_400_000;
}

/**
 * Evaluates one licence claim into a `RightsEvidence` with a decided status.
 *
 * `now` is injectable so freshness is testable without a clock.
 */
export function evaluateRights(input: LicenseInput, now: number = Date.now()): RightsEvidence {
  const accepted = acceptableLicenses().includes(input.license);
  const attributionRequired = input.attributionRequired ?? !NO_ATTRIBUTION.has(input.license);
  const stale = daysSince(input.verifiedAt, now) > VERIFICATION_FRESHNESS_DAYS;

  let status: RightsStatus;
  if (!input.license || !input.evidenceUrl) status = 'unknown';
  else if (!accepted) status = 'unsupported-license';
  else if (stale) status = 'stale-verification';
  else if (attributionRequired) status = 'attribution-required';
  else status = 'verified';

  return {
    license: input.license,
    licenseName: input.licenseName,
    evidenceUrl: input.evidenceUrl,
    attributionRequired,
    ...(input.attributionText ? { attributionText: input.attributionText } : {}),
    verifiedAt: input.verifiedAt,
    status,
  };
}

/**
 * Whether an *already-acquired* snapshot may still be used inside an existing
 * project. A pack acquired while its evidence was fresh keeps working even if
 * the catalogue's verification later goes stale - staleness never
 * retroactively breaks a game that was already built. Unsupported and unknown
 * remain hard blocks even here.
 */
export function rightsAllowExistingUse(rights: RightsEvidence): boolean {
  return (
    rights.status === 'verified' ||
    rights.status === 'attribution-required' ||
    rights.status === 'stale-verification'
  );
}

/**
 * Whether a candidate may be acquired *anew* into a project right now.
 * Stricter than existing-use: `stale-verification` is refused, because a new
 * acquisition must rest on currently-fresh authoritative evidence, not on a
 * licence string that merely still appears on the accepted list.
 */
export function rightsAllowNewAcquisition(rights: RightsEvidence): boolean {
  return rights.status === 'verified' || rights.status === 'attribution-required';
}

/** Whether a pack in this rights state may ship in a packed release without further action. */
export function rightsAllowShipping(rights: RightsEvidence): boolean {
  return rights.status === 'verified' || rights.status === 'attribution-required';
}

/**
 * @deprecated Ambiguous - pick `rightsAllowExistingUse` or
 * `rightsAllowNewAcquisition`. Retained as the existing-use meaning so no
 * caller silently changes behaviour on the strict side.
 */
export const rightsAllowUse = rightsAllowExistingUse;
