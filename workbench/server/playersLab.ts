/**
 * Local multiplayer roster authoring surface (post-ten program Phase 15).
 *
 * Reads and updates `content/players.json` - the document whose presence opts a
 * generated game into the `input.players` routing capability. Deliberately small:
 * player counts, the ready policy, slot ids and the gamepad deadzone are the
 * things a creator actually tunes. This is not a controller-remapping
 * application; per-action rebinding belongs to the existing binding surface, and
 * inventing a second one here would give two answers to "what is MOVE_LEFT".
 *
 * Validates against urn:sw2d:schema:content-players:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { PlayerRosterDocument } from '@sw2d/contracts';
import { validatePlayerRosterDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface PlayersInspectResult {
  readonly roster: PlayerRosterDocument;
  /** The default profiles a slot can be seated on, for display alongside the roster. */
  readonly keyboardProfileIds: readonly string[];
}

export interface PlayersUpdateResult {
  readonly ok: boolean;
  readonly roster: PlayerRosterDocument;
}

/**
 * Mirrors `DEFAULT_KEYBOARD_PROFILES` in @sw2d/runtime. Named here rather than
 * imported because the Workbench server must not load the renderer package;
 * `workbench/test/` asserts the two lists agree.
 */
export const DEFAULT_KEYBOARD_PROFILE_IDS: readonly string[] = ['keyboard-left', 'keyboard-right'];

function loadRoster(gameId: string): PlayerRosterDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'players.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/players.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/players.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ players: raw }).players!.value as PlayerRosterDocument;
  validatePlayerRosterDocument(validated);
  return validated;
}

export function inspectPlayers(gameId: string): PlayersInspectResult {
  return { roster: loadRoster(gameId), keyboardProfileIds: DEFAULT_KEYBOARD_PROFILE_IDS };
}

export function updatePlayers(gameId: string, payload: unknown): PlayersUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Players update payload must be a PlayerRosterDocument object.');
  }
  const validated = validateDocumentOrThrow('player-roster', 'content/players.json', payload) as PlayerRosterDocument;
  // The schema cannot express min <= max, or that playerIds agrees with maxPlayers.
  try {
    validatePlayerRosterDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'players.json');
  writeJsonAtomic(target, validated);
  return { ok: true, roster: validated };
}
