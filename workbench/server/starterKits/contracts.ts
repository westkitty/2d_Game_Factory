import type { GameSeed } from '../../shared/types.ts';

export type StarterKitDepth = GameSeed['starterKitDepth'];

export interface StarterKit {
  readonly presetId: string;
  readonly depth: StarterKitDepth;
  /** One sentence, present tense, describing what the player actually does. */
  readonly loop: string;
  /** Semantic roles the kit visibly consumes when supplied by the project. */
  readonly usefulRoles: readonly string[];
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string>;
}
