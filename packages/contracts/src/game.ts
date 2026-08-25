import type { ActionBindings } from './input.ts';
import type { GameSettings } from './persistence.ts';
import type { SystemPackSelection } from './systems.ts';

/**
 * The declarative description of one game.
 *
 * Everything a normal game changes lives here or in its content bundle. Editing
 * reusable runtime internals is not part of ordinary game work.
 */
export interface GameDefinition {
  /** Stable id. Namespaces persistence; two games never share save data. */
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly schemaVersion: number;
  readonly bindings: ActionBindings;
  readonly systemPacks: readonly SystemPackSelection[];
  readonly defaultSettings?: Partial<Omit<GameSettings, 'schemaVersion'>>;
  /** Logical canvas size. Scaling to the viewport is the runtime's job. */
  readonly viewport: { readonly width: number; readonly height: number };
}
