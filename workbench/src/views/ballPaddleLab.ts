/**
 * Ball & paddle authoring surface (post-ten program Phase 16).
 *
 * Tunes the feel of a Breakout or Pong: ball speed and its bounds, the per-hit
 * speed increase, how much a paddle hit can steer the ball, paddle size and
 * speed, and the match rules. Brick placement is reported but not edited here -
 * that is the Scene Composer's spatial job, and a second numeric editor for it
 * would give two answers to where a brick is.
 *
 * Calls `POST /api/arena/inspect` and `POST /api/arena/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface BallModel {
  radius: number;
  initialSpeed: number;
  minimumSpeed: number;
  maximumSpeed: number;
  speedIncreasePerHit: number;
  maximumBounceAngleDegrees: number;
  servePolicy: { kind: string; dx: number; dy: number; seed?: number; spreadDegrees?: number };
}

interface PaddleModel {
  id: string;
  playerId?: string;
  axis: string;
  facing: string;
  width: number;
  height: number;
  speed: number;
  bounceInfluence: number;
}

interface DocumentModel {
  schemaVersion: 1;
  ball: BallModel;
  arena: Record<string, unknown>;
  paddles: PaddleModel[];
  bricks?: unknown[];
  layout?: unknown[];
  match?: { targetScore?: number; lives?: number };
}

interface InspectResult {
  document: DocumentModel;
  brickCount: number;
  paddleCount: number;
  edgeSummary: { edge: string; behavior: string; scoresFor: string | null }[];
}

function field(label: string, value: number, attrs: Record<string, string>): {
  row: HTMLElement;
  input: HTMLInputElement;
} {
  const input = el('input', {
    attrs: { type: 'number', value: String(value), ...attrs },
    style: { width: '80px', padding: '2px 4px', 'font-size': '12px' },
  }) as HTMLInputElement;
  const row = el(
    'div',
    { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
    el('span', { style: { 'min-width': '190px' }, text: label }),
    input,
  );
  return { row, input };
}

export function renderBallPaddleLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Ball & Paddle' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<InspectResult>('/arena/inspect', { gameId });
      if (disposed) return;
      const doc = result.document;
      const ball = doc.ball;
      const firstPaddle = doc.paddles[0];

      const initial = field('Ball initial speed', ball.initialSpeed, { min: '1', step: '10' });
      const minimum = field('Ball minimum speed', ball.minimumSpeed, { min: '1', step: '10' });
      const maximum = field('Ball maximum speed', ball.maximumSpeed, { min: '1', step: '10' });
      const increase = field('Speed gain per paddle hit', ball.speedIncreasePerHit, { min: '0', step: '1' });
      const angle = field('Max bounce angle (deg)', ball.maximumBounceAngleDegrees, {
        min: '1',
        max: '80',
        step: '1',
      });
      const paddleSpeed = field('Paddle speed', firstPaddle?.speed ?? 0, { min: '1', step: '10' });
      const paddleWidth = field('Paddle width', firstPaddle?.width ?? 0, { min: '1', step: '2' });
      const paddleHeight = field('Paddle height', firstPaddle?.height ?? 0, { min: '1', step: '2' });
      const target = field('Match target score (0 = board clear)', doc.match?.targetScore ?? 0, {
        min: '0',
        step: '1',
      });
      const lives = field('Lives (0 = unlimited)', doc.match?.lives ?? 0, { min: '0', step: '1' });

      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      saveBtn.addEventListener('click', async () => {
        const nextMatch: { targetScore?: number; lives?: number } = {};
        const targetValue = Number.parseFloat(target.input.value);
        const livesValue = Number.parseInt(lives.input.value, 10);
        if (targetValue > 0) nextMatch.targetScore = targetValue;
        if (livesValue > 0) nextMatch.lives = livesValue;

        const next: DocumentModel = {
          ...doc,
          ball: {
            ...ball,
            initialSpeed: Number.parseFloat(initial.input.value),
            minimumSpeed: Number.parseFloat(minimum.input.value),
            maximumSpeed: Number.parseFloat(maximum.input.value),
            speedIncreasePerHit: Number.parseFloat(increase.input.value),
            maximumBounceAngleDegrees: Number.parseFloat(angle.input.value),
          },
          paddles: doc.paddles.map((paddle) => ({
            ...paddle,
            speed: Number.parseFloat(paddleSpeed.input.value),
            width: Number.parseFloat(paddleWidth.input.value),
            height: Number.parseFloat(paddleHeight.input.value),
          })),
          ...(Object.keys(nextMatch).length > 0 ? { match: nextMatch } : {}),
        };

        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/arena/update', { gameId, document: next });
          status.textContent = 'Saved!';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
        } catch (error) {
          status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
          saveBtn.disabled = false;
        }
      });

      const edges = result.edgeSummary
        .map((edge) => `${edge.edge}: ${edge.behavior}${edge.scoresFor ? ` -> ${edge.scoresFor}` : ''}`)
        .join(', ');

      replace(
        body,
        el('div', {
          class: 'faint',
          style: { 'margin-bottom': '8px' },
          text: `${result.paddleCount} paddle(s), ${result.brickCount} brick(s). Edges - ${edges || 'all bounce'}.`,
        }),
        initial.row,
        minimum.row,
        maximum.row,
        increase.row,
        angle.row,
        el('div', {
          class: 'faint',
          style: { 'margin-bottom': '6px' },
          text: 'Bounce angle is capped at 80 degrees: beyond that a paddle can send the ball along its own face.',
        }),
        paddleSpeed.row,
        paddleWidth.row,
        paddleHeight.row,
        target.row,
        lives.row,
        el('div', {
          class: 'faint',
          style: { 'margin-top': '6px' },
          text: 'Brick placement is edited in the Scene Composer, not here.',
        }),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/ball-paddle.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
