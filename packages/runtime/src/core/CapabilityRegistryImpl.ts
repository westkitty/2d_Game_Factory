import type { CapabilityId, CapabilityRegistry, Disposable } from '@sw2d/contracts';

/** Thrown when a pack asks for a capability nobody published. */
export class MissingCapabilityError extends Error {
  constructor(
    readonly capabilityId: CapabilityId,
    available: readonly CapabilityId[],
  ) {
    super(
      `Capability "${capabilityId}" is not available. ` +
        `Registered capabilities: ${available.length > 0 ? available.join(', ') : '(none)'}.`,
    );
    this.name = 'MissingCapabilityError';
  }
}

/** Thrown when two packs claim the same capability id. */
export class DuplicateCapabilityError extends Error {
  constructor(readonly capabilityId: CapabilityId) {
    super(`Capability "${capabilityId}" is already provided. Capability ids must be unique.`);
    this.name = 'DuplicateCapabilityError';
  }
}

export class CapabilityRegistryImpl implements CapabilityRegistry {
  readonly #values = new Map<CapabilityId, unknown>();

  provide<T>(id: CapabilityId, value: T): Disposable {
    if (this.#values.has(id)) throw new DuplicateCapabilityError(id);
    this.#values.set(id, value);
    return {
      dispose: () => {
        if (this.#values.get(id) === value) this.#values.delete(id);
      },
    };
  }

  get<T>(id: CapabilityId): T | undefined {
    return this.#values.get(id) as T | undefined;
  }

  require<T>(id: CapabilityId): T {
    if (!this.#values.has(id)) throw new MissingCapabilityError(id, this.list());
    return this.#values.get(id) as T;
  }

  has(id: CapabilityId): boolean {
    return this.#values.has(id);
  }

  list(): readonly CapabilityId[] {
    return [...this.#values.keys()].sort();
  }
}
