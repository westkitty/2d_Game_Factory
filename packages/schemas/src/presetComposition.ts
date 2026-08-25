import type { PresetDefinition, SystemPackSelection } from '@sw2d/contracts';

/**
 * Semantic composition rules JSON Schema cannot express by itself: uniqueness
 * of a pack reference across two separate arrays (requiredSystemPacks and
 * optionalSystemPacks). Shape validation lives in the schema; this is the
 * smallest pure function for the cross-field rule schema validation can't
 * reach.
 *
 * Pack *dependency order* (do capabilities resolve, are there cycles) is
 * already implemented and tested in @sw2d/runtime's `resolveInstallOrder`.
 * That function is pure and unrelated to Phaser, so its Phase 1 coverage is
 * the regression evidence for dependency ordering and cycle detection; this
 * module does not duplicate it. A PresetDefinition's selections carry no
 * dependency edges of their own (only a pack id and opaque config), so a
 * preset cannot represent a dependency cycle - only resolveInstallOrder's
 * SystemPackDefinition-level graph can.
 */

export interface PackSelectionCheckIssue {
  readonly packId: string;
  readonly message: string;
}

/** Deterministic: same input, same output, same order, every time. */
export function checkSystemPackSelections(
  selections: readonly SystemPackSelection[],
): readonly PackSelectionCheckIssue[] {
  const firstSeenAt = new Map<string, number>();
  const issues: PackSelectionCheckIssue[] = [];

  selections.forEach((selection, index) => {
    if (selection.packId.trim().length === 0) {
      issues.push({ packId: selection.packId, message: `selection at index ${index} has an empty packId` });
      return;
    }
    const firstIndex = firstSeenAt.get(selection.packId);
    if (firstIndex !== undefined) {
      issues.push({
        packId: selection.packId,
        message: `duplicate system pack reference "${selection.packId}" (first at index ${firstIndex}, again at index ${index})`,
      });
      return;
    }
    firstSeenAt.set(selection.packId, index);
  });

  return issues;
}

/**
 * Validate the combined requiredSystemPacks + optionalSystemPacks reference
 * list of a schema-valid PresetDefinition for duplicate or empty pack
 * references. Does not check against a pack catalogue - no such registry
 * exists yet (packs arrive in Phase 4).
 */
export function validatePresetComposition(preset: PresetDefinition): readonly PackSelectionCheckIssue[] {
  return checkSystemPackSelections([...preset.requiredSystemPacks, ...preset.optionalSystemPacks]);
}
