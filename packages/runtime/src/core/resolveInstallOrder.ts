import type {
  CapabilityId,
  GameContext,
  SystemPackDefinition,
  SystemPackSelection,
} from '@sw2d/contracts';

export class SystemPackResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemPackResolutionError';
  }
}

export type AnyPackDefinition = SystemPackDefinition<never, GameContext>;

export interface ResolveOptions {
  /** Pack definitions available to install, keyed by pack id. */
  readonly registry: ReadonlyMap<string, { readonly id: string; readonly provides: readonly CapabilityId[]; readonly dependencies: readonly CapabilityId[]; readonly optionalDependencies?: readonly CapabilityId[] }>;
  /** Capabilities already published by the host before any pack installs. */
  readonly preexisting: readonly CapabilityId[];
}

/**
 * Deterministic dependency resolution for a set of selected system packs.
 *
 * Deliberately a pure function so pack composition can be tested without a
 * browser, a renderer or a running game. Errors name the offending pack and
 * capability rather than failing generically.
 *
 * Ordering is stable: among packs whose dependencies are satisfied, the one
 * appearing earliest in `selections` installs first. Two identical inputs always
 * produce the same order.
 */
export function resolveInstallOrder(
  selections: readonly SystemPackSelection[],
  options: ResolveOptions,
): readonly SystemPackSelection[] {
  const seen = new Set<string>();
  for (const selection of selections) {
    if (seen.has(selection.packId)) {
      throw new SystemPackResolutionError(
        `System pack "${selection.packId}" is selected more than once.`,
      );
    }
    seen.add(selection.packId);
    if (!options.registry.has(selection.packId)) {
      const known = [...options.registry.keys()].sort();
      throw new SystemPackResolutionError(
        `System pack "${selection.packId}" is not registered. ` +
          `Registered packs: ${known.length > 0 ? known.join(', ') : '(none)'}.`,
      );
    }
  }

  const providedBySelection = new Map<CapabilityId, string>();
  for (const selection of selections) {
    const definition = options.registry.get(selection.packId)!;
    for (const capability of definition.provides) {
      const owner = providedBySelection.get(capability);
      if (owner !== undefined) {
        throw new SystemPackResolutionError(
          `Capability "${capability}" is provided by both "${owner}" and "${selection.packId}".`,
        );
      }
      if (options.preexisting.includes(capability)) {
        throw new SystemPackResolutionError(
          `Capability "${capability}" from pack "${selection.packId}" collides with a core capability.`,
        );
      }
      providedBySelection.set(capability, selection.packId);
    }
  }

  const satisfied = new Set<CapabilityId>(options.preexisting);
  const remaining = [...selections];
  const ordered: SystemPackSelection[] = [];

  while (remaining.length > 0) {
    const index = remaining.findIndex((selection) => {
      const definition = options.registry.get(selection.packId)!;
      return definition.dependencies.every((capability) => satisfied.has(capability));
    });

    if (index === -1) {
      const blocked = remaining.map((selection) => {
        const definition = options.registry.get(selection.packId)!;
        const missing = definition.dependencies.filter((capability) => !satisfied.has(capability));
        const unknown = missing.filter((capability) => !providedBySelection.has(capability));
        const detail = unknown.length > 0
          ? `missing capability ${unknown.map((c) => `"${c}"`).join(', ')} (not provided by any selected pack)`
          : `waiting on ${missing.map((c) => `"${c}"`).join(', ')} (dependency cycle)`;
        return `  - "${selection.packId}": ${detail}`;
      });
      throw new SystemPackResolutionError(
        `Cannot resolve system pack install order.\n${blocked.join('\n')}`,
      );
    }

    const [selection] = remaining.splice(index, 1);
    const definition = options.registry.get(selection!.packId)!;
    for (const capability of definition.provides) satisfied.add(capability);
    ordered.push(selection!);
  }

  return ordered;
}
