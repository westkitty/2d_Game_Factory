import type { AssetCatalog, AssetDescriptor, AssetRole } from '@sw2d/contracts';

export class UnknownAssetRoleError extends Error {
  constructor(role: string, available: readonly string[]) {
    super(
      `No asset registered for role "${role}". ` +
        `Roles supplied by the current content bundle: ${available.length > 0 ? available.join(', ') : '(none)'}.`,
    );
    this.name = 'UnknownAssetRoleError';
  }
}

/**
 * Semantic role -> texture key.
 *
 * Gameplay asks for 'player', never for a file name. Swapping a theme therefore
 * changes what is drawn without touching a line of gameplay code, and a missing
 * role fails with the offending name instead of rendering an invisible sprite.
 */
export class AssetCatalogImpl implements AssetCatalog {
  readonly #byRole = new Map<AssetRole, AssetDescriptor>();

  constructor(descriptors: readonly AssetDescriptor[]) {
    for (const descriptor of descriptors) this.#byRole.set(descriptor.role, descriptor);
  }

  has(role: AssetRole): boolean {
    return this.#byRole.has(role);
  }

  resolve(role: AssetRole): string {
    const descriptor = this.#byRole.get(role);
    if (!descriptor) throw new UnknownAssetRoleError(role, [...this.#byRole.keys()]);
    return descriptor.key;
  }

  list(): readonly AssetDescriptor[] {
    return [...this.#byRole.values()];
  }
}
