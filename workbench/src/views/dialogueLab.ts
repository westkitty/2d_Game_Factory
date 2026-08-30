/**
 * Dialogue authoring surface (post-ten program Phase 20).
 *
 * Edits the text a writer rewrites constantly - line text, choice text, a
 * character's display name - and **reports** the graph: which node a choice
 * leads to, what gates it, and what it changes.
 *
 * Structure is deliberately not editable here. Spec 20.11 is explicit that this
 * must not become universal visual scripting, and a form for rewiring an
 * arbitrary condition graph is exactly that.
 *
 * The panel surfaces what JSON hides: nodes nothing can reach. A scene no path
 * leads to is the most common dialogue mistake and is invisible in the file.
 *
 * Calls `POST /api/script/inspect` and `POST /api/script/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface CharacterSummary {
  id: string;
  displayName: string;
  expressions: string[];
  defaultExpression: string | null;
  lineCount: number;
}

interface LineSummary {
  id: string;
  nodeId: string;
  speaker: string | null;
  text: string;
  expression: string | null;
  effects: string[];
}

interface ChoiceSummary {
  id: string;
  nodeId: string;
  text: string;
  target: string | null;
  once: boolean;
  conditions: string[];
  effects: string[];
}

interface NodeSummary {
  id: string;
  lineCount: number;
  choiceCount: number;
  next: string | null;
  reachable: boolean;
}

interface DocumentModel {
  schemaVersion: 1;
  startNode?: string;
  characters?: { id: string; displayName: string }[];
  nodes: { id: string; lines: { id: string; text: string }[]; choices?: { id: string; text: string }[] }[];
}

interface InspectResult {
  document: DocumentModel;
  startNode: string;
  characters: CharacterSummary[];
  nodes: NodeSummary[];
  lines: LineSummary[];
  choices: ChoiceSummary[];
  unreachableNodes: string[];
}

function textField(label: string, value: string): { row: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    attrs: { type: 'text', value },
    style: { flex: '1 1 auto', 'min-width': '0', padding: '2px 4px', 'font-size': '12px' },
  }) as HTMLInputElement;
  const row = el(
    'div',
    { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
    el('span', { class: 'faint', style: { 'min-width': '90px', 'font-size': '11px' }, text: label }),
    input,
  );
  return { row, input };
}

const block = (...children: (HTMLElement | null)[]): HTMLElement =>
  el(
    'div',
    {
      style: {
        'border-bottom': '1px solid var(--color-border, #333)',
        'padding-bottom': '8px',
        'margin-bottom': '8px',
      },
    },
    ...children,
  );

export function renderDialogueLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Dialogue' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<InspectResult>('/script/inspect', { gameId });
      if (disposed) return;
      const doc = result.document;

      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      const characterInputs = result.characters.map((character) => {
        const name = textField('Name', character.displayName);
        return {
          id: character.id,
          name,
          block: block(
            el('div', { style: { 'font-weight': 'bold' }, text: character.id }),
            name.row,
            el('div', {
              class: 'faint',
              text:
                `${character.lineCount} line(s). ` +
                (character.expressions.length > 0
                  ? `Expressions: ${character.expressions.join(', ')}${character.defaultExpression ? ` (default ${character.defaultExpression})` : ''}.`
                  : 'No portraits - a zero-art character is valid.'),
            }),
          ),
        };
      });

      const lineInputs = result.lines.map((line) => {
        const text = textField(line.speaker ?? '(narration)', line.text);
        return {
          nodeId: line.nodeId,
          id: line.id,
          text,
          block: el(
            'div',
            { style: { 'margin-bottom': '6px' } },
            text.row,
            el('div', {
              class: 'faint',
              style: { 'font-size': '11px' },
              text:
                `${line.nodeId} / ${line.id}` +
                (line.expression ? ` · ${line.expression}` : '') +
                (line.effects.length > 0 ? ` · ${line.effects.join('; ')}` : ''),
            }),
          ),
        };
      });

      const choiceInputs = result.choices.map((choice) => {
        const text = textField('Choice', choice.text);
        return {
          nodeId: choice.nodeId,
          id: choice.id,
          text,
          block: el(
            'div',
            { style: { 'margin-bottom': '6px' } },
            text.row,
            el('div', {
              class: 'faint',
              style: { 'font-size': '11px' },
              text:
                `${choice.nodeId} / ${choice.id} → ${choice.target ?? '(ends)'}` +
                (choice.once ? ' · once' : '') +
                (choice.conditions.length > 0 ? ` · needs ${choice.conditions.join(' and ')}` : '') +
                (choice.effects.length > 0 ? ` · does ${choice.effects.join('; ')}` : ''),
            }),
          ),
        };
      });

      saveBtn.addEventListener('click', async () => {
        const next: DocumentModel = {
          ...doc,
          ...(doc.characters
            ? {
                characters: doc.characters.map((character) => {
                  const inputs = characterInputs.find((entry) => entry.id === character.id);
                  return inputs ? { ...character, displayName: inputs.name.input.value } : character;
                }),
              }
            : {}),
          nodes: doc.nodes.map((node) => ({
            ...node,
            lines: node.lines.map((line) => {
              const inputs = lineInputs.find((entry) => entry.nodeId === node.id && entry.id === line.id);
              return inputs ? { ...line, text: inputs.text.input.value } : line;
            }),
            ...(node.choices
              ? {
                  choices: node.choices.map((choice) => {
                    const inputs = choiceInputs.find((entry) => entry.nodeId === node.id && entry.id === choice.id);
                    return inputs ? { ...choice, text: inputs.text.input.value } : choice;
                  }),
                }
              : {}),
          })),
        };

        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/script/update', { gameId, document: next });
          status.textContent = 'Saved!';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
          void refresh();
        } catch (error) {
          status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
          saveBtn.disabled = false;
        }
      });

      replace(
        body,
        el('div', {
          class: 'faint',
          style: { 'margin-bottom': '8px' },
          text:
            `${result.nodes.length} node(s), ${result.lines.length} line(s), ${result.choices.length} choice(s), ` +
            `${result.characters.length} character(s). Starts at "${result.startNode}".`,
        }),
        result.unreachableNodes.length > 0
          ? el('div', {
              style: { color: 'var(--color-warn, #d88)', 'margin-bottom': '8px' },
              text: `Unreachable from the start: ${result.unreachableNodes.join(', ')} - no path leads to these.`,
            })
          : el('div', { class: 'faint', style: { 'margin-bottom': '8px' }, text: 'Every node is reachable from the start.' }),
        result.characters.length > 0 ? el('div', { style: { 'font-weight': 'bold' }, text: 'Characters' }) : null,
        ...characterInputs.map((entry) => entry.block),
        el('div', { style: { 'font-weight': 'bold' }, text: 'Lines' }),
        block(...lineInputs.map((entry) => entry.block)),
        result.choices.length > 0 ? el('div', { style: { 'font-weight': 'bold' }, text: 'Choices' }) : null,
        result.choices.length > 0 ? block(...choiceInputs.map((entry) => entry.block)) : null,
        el('div', {
          class: 'faint',
          text: 'Nodes, targets, conditions and effects are authored in content/dialogue.json - this panel edits what characters say, not what the graph does.',
        }),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/dialogue.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
