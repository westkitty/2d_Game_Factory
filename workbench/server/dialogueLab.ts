/**
 * Dialogue authoring surface (post-ten program Phase 20).
 *
 * Reads and updates `content/dialogue.json`. The editable fields are the ones a
 * writer changes constantly and safely: **line text**, choice text, and a
 * character's display name.
 *
 * **Graph structure - nodes, targets, conditions and effects - is reported, not
 * edited.** Spec 20.11 is explicit that this must not become universal visual
 * scripting, and a form that lets a creator rewire an arbitrary condition graph
 * is exactly that. What the panel does instead is show the structure clearly
 * enough that a writer can see what they are writing into: which node each
 * choice leads to, what gates it, and what it changes.
 *
 * The panel also computes what JSON hides: which nodes are unreachable from the
 * start node. A scene nobody can get to is the most common dialogue mistake and
 * is invisible in the file.
 *
 * Validates against urn:sw2d:schema:content-dialogue:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { DialogueCondition, DialogueDocument, DialogueEffect } from '@sw2d/contracts';
import { validateDialogueDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface CharacterSummary {
  readonly id: string;
  readonly displayName: string;
  readonly expressions: readonly string[];
  readonly defaultExpression: string | null;
  readonly lineCount: number;
}

export interface LineSummary {
  readonly id: string;
  readonly nodeId: string;
  readonly speaker: string | null;
  readonly text: string;
  readonly expression: string | null;
  readonly effects: readonly string[];
}

export interface ChoiceSummary {
  readonly id: string;
  readonly nodeId: string;
  readonly text: string;
  readonly target: string | null;
  readonly once: boolean;
  readonly conditions: readonly string[];
  readonly effects: readonly string[];
}

export interface NodeSummary {
  readonly id: string;
  readonly lineCount: number;
  readonly choiceCount: number;
  readonly next: string | null;
  /** Reachable from the start node by following next/target/transition edges. */
  readonly reachable: boolean;
}

export interface DialogueInspectResult {
  readonly document: DialogueDocument;
  readonly startNode: string;
  readonly characters: readonly CharacterSummary[];
  readonly nodes: readonly NodeSummary[];
  readonly lines: readonly LineSummary[];
  readonly choices: readonly ChoiceSummary[];
  /** Node ids nothing can reach. The mistake a JSON file hides best. */
  readonly unreachableNodes: readonly string[];
}

export interface DialogueUpdateResult {
  readonly ok: boolean;
  readonly document: DialogueDocument;
}

function loadDocument(gameId: string): DialogueDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'dialogue.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/dialogue.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/dialogue.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ dialogue: raw }).dialogue!.value as DialogueDocument;
  validateDialogueDocument(validated);
  return validated;
}

/** Human-readable one-liners for a condition or effect. Reported, never edited. */
function describeCondition(condition: DialogueCondition): string {
  switch (condition.kind) {
    case 'narrative-flag':
    case 'world-flag':
    case 'progression-unlock':
      return `${condition.kind} "${condition.flag}" is ${condition.value ?? true}`;
    case 'seen-node':
      return `node "${condition.nodeId}" ${(condition.value ?? true) ? 'seen' : 'not seen'}`;
    case 'seen-line':
      return `line "${condition.lineId}" ${(condition.value ?? true) ? 'seen' : 'not seen'}`;
    case 'choice-count':
      return `choice "${condition.choiceId}" taken ${condition.comparison} ${condition.count}`;
    case 'item-count':
      return `item "${condition.itemId}" ${condition.comparison} ${condition.count}`;
  }
}

function describeEffect(effect: DialogueEffect): string {
  switch (effect.kind) {
    case 'set-narrative-flag':
    case 'set-world-flag':
      return `${effect.kind} "${effect.flag}" = ${effect.value}`;
    case 'grant-item':
      return `grant ${effect.quantity ?? 1}x "${effect.itemId}"`;
    case 'remove-item':
      return `remove ${effect.quantity ?? 1}x "${effect.itemId}"`;
    case 'progression': {
      const parts: string[] = [];
      if (effect.currency !== undefined) parts.push(`currency ${effect.currency >= 0 ? '+' : ''}${effect.currency}`);
      if (effect.xp !== undefined) parts.push(`xp ${effect.xp >= 0 ? '+' : ''}${effect.xp}`);
      if (effect.unlock !== undefined) parts.push(`unlock "${effect.unlock}"`);
      return parts.length > 0 ? parts.join(', ') : 'progression (nothing)';
    }
    case 'mark-seen':
      return `mark codex entry "${effect.entryId}" seen`;
    case 'world-transition':
      return `go to node "${effect.nodeId}"`;
  }
}

/** Nodes reachable from the start by following every kind of edge. */
function reachableFrom(document: DialogueDocument, startNode: string): ReadonlySet<string> {
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const queue = [startNode];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    const edges: string[] = [];
    if (node.next) edges.push(node.next);
    for (const line of node.lines) {
      for (const effect of line.effects ?? []) {
        if (effect.kind === 'world-transition') edges.push(effect.nodeId);
      }
    }
    for (const choice of node.choices ?? []) {
      if (choice.target) edges.push(choice.target);
      for (const effect of choice.effects ?? []) {
        if (effect.kind === 'world-transition') edges.push(effect.nodeId);
      }
    }
    queue.push(...edges);
  }
  return seen;
}

export function inspectDialogue(gameId: string): DialogueInspectResult {
  const document = loadDocument(gameId);
  const startNode = document.startNode ?? document.nodes[0]!.id;
  const reachable = reachableFrom(document, startNode);

  const lines: LineSummary[] = [];
  const choices: ChoiceSummary[] = [];
  const linesPerSpeaker = new Map<string, number>();

  for (const node of document.nodes) {
    for (const line of node.lines) {
      if (line.speaker) linesPerSpeaker.set(line.speaker, (linesPerSpeaker.get(line.speaker) ?? 0) + 1);
      lines.push({
        id: line.id,
        nodeId: node.id,
        speaker: line.speaker ?? null,
        text: line.text,
        expression: line.expression ?? null,
        effects: (line.effects ?? []).map(describeEffect),
      });
    }
    for (const choice of node.choices ?? []) {
      choices.push({
        id: choice.id,
        nodeId: node.id,
        text: choice.text,
        target: choice.target ?? null,
        once: choice.once === true,
        conditions: (choice.conditions ?? []).map(describeCondition),
        effects: (choice.effects ?? []).map(describeEffect),
      });
    }
  }

  return {
    document,
    startNode,
    lines,
    choices,
    unreachableNodes: document.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id),
    nodes: document.nodes.map((node) => ({
      id: node.id,
      lineCount: node.lines.length,
      choiceCount: node.choices?.length ?? 0,
      next: node.next ?? null,
      reachable: reachable.has(node.id),
    })),
    characters: (document.characters ?? []).map((character) => ({
      id: character.id,
      displayName: character.displayName,
      expressions: Object.keys(character.portraits ?? {}),
      defaultExpression: character.defaultExpression ?? null,
      lineCount: linesPerSpeaker.get(character.id) ?? 0,
    })),
  };
}

export function updateDialogue(gameId: string, payload: unknown): DialogueUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Dialogue update payload must be a DialogueDocument object.');
  }
  const validated = validateDocumentOrThrow('dialogue', 'content/dialogue.json', payload) as DialogueDocument;
  // The schema cannot see a dangling target, a speaker who is not a character,
  // or an expression the speaker has no portrait for.
  try {
    validateDialogueDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'dialogue.json');
  writeJsonAtomic(target, validated);
  return { ok: true, document: validated };
}
