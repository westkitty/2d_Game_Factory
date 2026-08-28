/**
 * Coherent reskin: propose one representative sprite per role from a freshly
 * acquired pack, so the user can audition and confirm the pack "as a look"
 * rather than mapping hundreds of files by hand.
 *
 * Pure and deterministic. It only proposes; the user still accepts, rejects or
 * swaps in the audition, and the confirmed assignments go through the normal
 * commit -> theme-synthesis path (no shadow runtime, provenance intact).
 */

import type { WorkbenchAssetRole } from '../../shared/types.ts';

export interface StagedFileLite {
  readonly stagingId: string;
  readonly displayName: string;
  readonly suggestedRoles: readonly WorkbenchAssetRole[];
  readonly analysis: { readonly width: number; readonly height: number; readonly hasAlpha: boolean; readonly aspectRatio: number };
}

export interface ReskinAssignment {
  readonly role: WorkbenchAssetRole;
  readonly stagingId: string;
  readonly displayName: string;
  /** 'named' when the filename implied the role, 'shape' when only the image shape did. */
  readonly basis: 'named' | 'shape';
}

export interface ReskinProposal {
  readonly assignments: readonly ReskinAssignment[];
  /** Requested roles nothing in the pack could reasonably fill - these keep generated fallback art. */
  readonly fallbackRoles: readonly WorkbenchAssetRole[];
}

/** A weak shape guess for a role, used only when no filename mentioned it. */
function shapeMatch(role: WorkbenchAssetRole, file: StagedFileLite): boolean {
  const { hasAlpha, aspectRatio, width } = file.analysis;
  switch (role) {
    case 'background':
      return !hasAlpha && width >= 128 && aspectRatio >= 1.2;
    case 'player':
    case 'enemy':
      return hasAlpha && aspectRatio >= 0.6 && aspectRatio <= 1.6;
    case 'pickup':
    case 'particle':
      return hasAlpha && aspectRatio >= 0.7 && aspectRatio <= 1.4 && width <= 64;
    case 'tile':
    case 'platform':
      return Math.abs(aspectRatio - 1) < 0.35;
    default:
      return false;
  }
}

/**
 * @param roles roles the requirement profile asked for, in priority order
 * @param files the pack's staged files
 */
export function proposeReskin(roles: readonly WorkbenchAssetRole[], files: readonly StagedFileLite[]): ReskinProposal {
  const taken = new Set<string>();
  const assignments: ReskinAssignment[] = [];
  const fallbackRoles: WorkbenchAssetRole[] = [];

  for (const role of roles) {
    // 1. a file whose name put this role first
    let pick = files.find((file) => !taken.has(file.stagingId) && file.suggestedRoles[0] === role);
    let basis: ReskinAssignment['basis'] = 'named';
    // 2. a file whose name mentioned this role at all
    if (!pick) pick = files.find((file) => !taken.has(file.stagingId) && file.suggestedRoles.includes(role));
    // 3. a file whose shape is a reasonable fit
    if (!pick) {
      pick = files.find((file) => !taken.has(file.stagingId) && shapeMatch(role, file));
      basis = 'shape';
    }
    if (pick) {
      taken.add(pick.stagingId);
      assignments.push({ role, stagingId: pick.stagingId, displayName: pick.displayName, basis });
    } else {
      fallbackRoles.push(role);
    }
  }

  return { assignments, fallbackRoles };
}
