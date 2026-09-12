/**
 * Dialogue authoring surface (Category-C Wave 3 / ADR-0030).
 *
 * The smallest useful surface: surface the game's `content/dialogue.json`
 * (mode, conversations, hotspots). Read-only - editing is JSON work on
 * the file. Live node/flags belong on the in-game debug snapshot.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DialogueCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface DialogueInspectResult {
  readonly present: boolean;
  readonly mode: string;
  readonly startConversationId: string | null;
  readonly conversations: readonly { readonly id: string; readonly nodeCount: number }[];
  readonly hotspots: readonly { readonly id: string; readonly conversationId: string; readonly lockedBy: readonly string[] }[];
}

export function inspectDialogue(gameId: string): DialogueInspectResult {
  const full = path.join(gameRoot(gameId), 'content', 'dialogue.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/dialogue.json in "${gameId}".`);
  const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
  const catalog = validateContentBundleData({ dialogue: raw }).dialogue!.value as DialogueCatalog;
  return {
    present: catalog.conversations.length > 0,
    mode: catalog.mode,
    startConversationId: catalog.startConversationId ?? null,
    conversations: catalog.conversations.map((c) => ({ id: c.id, nodeCount: c.nodes.length })),
    hotspots: (catalog.hotspots ?? []).map((h) => ({
      id: h.id,
      conversationId: h.conversationId,
      lockedBy: h.requireFlags ?? [],
    })),
  };
}
