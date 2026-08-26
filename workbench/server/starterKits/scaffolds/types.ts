import type { WorkbenchAssetRole } from '../../../shared/types.ts';

export const ORIGINAL_RICH_KIT_IDS = ['chase-platformer', 'twin-stick-shooter', 'tower-defense', 'sokoban', 'idle-incremental'] as const;
export type OriginalRichKitId = (typeof ORIGINAL_RICH_KIT_IDS)[number];
export type ScaffoldPriority = 1 | 2 | 3;

export interface ExplicitStarterKitPlan {
  readonly loop: string;
  readonly referenceKit: OriginalRichKitId;
  readonly usefulRoles: readonly WorkbenchAssetRole[];
  readonly mechanicProofs: readonly string[];
  readonly priority: ScaffoldPriority;
  readonly implementationNotes: readonly string[];
}

export function plan(loop: string, referenceKit: OriginalRichKitId, usefulRoles: readonly WorkbenchAssetRole[], mechanicProofs: readonly string[], priority: ScaffoldPriority, implementationNotes: readonly string[] = []): ExplicitStarterKitPlan {
  return { loop, referenceKit, usefulRoles, mechanicProofs, priority, implementationNotes };
}
