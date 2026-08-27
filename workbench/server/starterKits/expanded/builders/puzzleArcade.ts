import { defineExpandedKit } from './common.ts';
import { withDefaultThemeRoles } from './themeRoles.ts';

export type PuzzleArcadeStarterVariant =
  | 'match-puzzle'
  | 'falling-block-puzzle'
  | 'breakout'
  | 'pong'
  | 'physics-puzzle'
  | 'maze-game'
  | 'rhythm-action'
  | 'reaction-timing'
  | 'pinball-lite';

function shellSource(variant: PuzzleArcadeStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const CELL = 52;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-puzzle-arcade',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const avatar = scene.add.sprite(70, 70, context.assets.resolve('player')).setDisplaySize(40, 40);
    const status = scene.add.text(18, 15, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#111827aa', padding: { x: 7, y: 4 } }).setDepth(100);
    const objects: Phaser.GameObjects.GameObject[] = [];
    const usesP3ePresentation = VARIANT === 'match-puzzle' || VARIANT === 'falling-block-puzzle' || VARIANT === 'pong';
    const cursorRoleSource = (VARIANT === 'match-puzzle' || VARIANT === 'physics-puzzle') && context.assets.has('ui.cursor') ? 'ui.cursor' : 'checkpoint';
    const cursorTextureKey = cursorRoleSource === 'ui.cursor' ? context.assets.resolve('ui.cursor') : context.assets.resolve('checkpoint');
    const panelRoleSource = (usesP3ePresentation || VARIANT === 'rhythm-action' || VARIANT === 'pinball-lite')
      ? (context.assets.has('ui.panel') ? 'ui.panel' : 'platform') : null;
    const panelTextureKey = panelRoleSource === 'ui.panel' ? context.assets.resolve('ui.panel') : panelRoleSource === 'platform' ? context.assets.resolve('platform') : null;
    const boardRoleSource = VARIANT === 'match-puzzle' ? 'pickup' : VARIANT === 'falling-block-puzzle' ? 'platform' : null;
    const boardRoleTextureKey = boardRoleSource === 'pickup' ? context.assets.resolve('pickup') : boardRoleSource === 'platform' ? context.assets.resolve('platform') : null;
    const rolePanel = panelTextureKey ? scene.add.sprite(185, 42, panelTextureKey).setDisplaySize(340, 58).setAlpha(0.28).setDepth(90) : null;
    if (rolePanel) objects.push(rolePanel);
    const buttonRoleSource = VARIANT === 'rhythm-action' && context.assets.has('ui.button') ? 'ui.button' : null;
    const button = buttonRoleSource ? scene.add.sprite(720, 105, context.assets.resolve('ui.button')).setDisplaySize(92, 42).setAlpha(0.9).setDepth(90) : null;
    if (button) objects.push(button);

    let elapsedMs = 0;
    let score = 0;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let lastAction = 'spawn';
    let cursor = { col: 0, row: 0 };
    let selected: { col: number; row: number } | null = null;
    let boardRevision = 0;
    let matchesCleared = 0;
    let pieceRow = 0;
    let pieceCol = 2;
    let pieceRotated = false;
    let linesCleared = 0;
    let paddleX = width / 2;
    let paddleY = height - 55;
    let opponentY = height / 2;
    let ballX = width / 2;
    let ballY = height / 2;
    let ballVx = 180;
    let ballVy = -180;
    let launched = false;
    let bricksRemaining = 0;
    let lives = 3;
    let playerScore = 0;
    let opponentScore = 0;
    let triggerActivated = false;
    let goalReached = false;
    let mazeHasPickup = false;
    let mazeCell = { col: 0, row: 0 };
    let beatIndex = 0;
    let beatHits = 0;
    let beatMisses = 0;
    let beatWindowOpen = false;
    let reactionRound = 0;
    let reactionSignal = false;
    let reactionSignalAt = 0;
    let reactionTimes: number[] = [];
    let falseStarts = 0;
    let bumperHits = 0;
    let drains = 0;
    let collisionBounces = 0;
    let hazardResolved = false;
    let particleEffects = 0;

    const boardSprites: Phaser.GameObjects.Rectangle[] = [];
    const boardRoleSprites: Phaser.GameObjects.Sprite[] = [];
    const brickSprites: Phaser.GameObjects.Sprite[] = [];
    const bumperSprites: Phaser.GameObjects.Sprite[] = [];
    const particleTextureKey = context.assets.has('particle') ? context.assets.resolve('particle') : null;
    const particles: Phaser.GameObjects.Sprite[] = [];
    const cursorSprite = scene.add.sprite(190, 125, cursorTextureKey).setDisplaySize(46, 46).setAlpha(0.65);
    objects.push(cursorSprite);
    const paddle = scene.add.sprite(paddleX, paddleY, context.assets.resolve('player')).setDisplaySize(120, 22);
    const opponent = scene.add.sprite(width - 55, opponentY, context.assets.resolve('enemy')).setDisplaySize(22, 110);
    const ball = scene.add.sprite(ballX, ballY, context.assets.resolve('pickup')).setDisplaySize(18, 18);
    objects.push(paddle, opponent, ball);

    let matchBoard = [
      [0, 1, 0],
      [1, 0, 2],
      [0, 2, 1],
    ];
    const mazeWalls = new Set(['1,1', '2,1', '3,1', '1,3', '2,3', '3,3', '3,2']);

    function boardPixel(col: number, row: number): [number, number] { return [190 + col * CELL, 125 + row * CELL]; }
    function tintFor(value: number): number { return [0x65d0a8, 0xe05fa0, 0xf0c274, 0x4f9ee0][Math.abs(value) % 4]!; }
    function clearBoardSprites(): void {
      while (boardSprites.length) boardSprites.pop()!.destroy();
      while (boardRoleSprites.length) boardRoleSprites.pop()!.destroy();
    }

    function drawMatchBoard(): void {
      clearBoardSprites();
      for (let row = 0; row < matchBoard.length; row++) for (let col = 0; col < matchBoard[row]!.length; col++) {
        const value = matchBoard[row]![col]!;
        const [x, y] = boardPixel(col, row);
        const rect = scene.add.rectangle(x, y, CELL - 6, CELL - 6, 0x202532, value < 0 ? 0.2 : 0.55).setStrokeStyle(1, 0xffffff, 0.25);
        boardSprites.push(rect);
        if (value >= 0 && boardRoleTextureKey) {
          const tile = scene.add.sprite(x, y, boardRoleTextureKey).setDisplaySize(CELL - 13, CELL - 13).setTint(tintFor(value)).setAlpha(0.92);
          boardRoleSprites.push(tile);
        }
      }
      cursorSprite.setPosition(...boardPixel(cursor.col, cursor.row));
    }

    function resolveMatches(): void {
      let cleared = 0;
      for (let row = 0; row < matchBoard.length; row++) {
        const values = matchBoard[row]!;
        const first = values[0]!;
        const second = values[1]!;
        const third = values[2]!;
        if (first >= 0 && first === second && second === third) {
          matchBoard[row] = [-1, -1, -1]; cleared += 3;
        }
      }
      if (cleared > 0) {
        matchesCleared += cleared; score += cleared * 10; boardRevision += 1; lastAction = 'match-clear';
        if (score >= 30) outcome = 'complete';
      }
      drawMatchBoard();
    }

    function matchInput(step: 'up' | 'down' | 'left' | 'right' | null, confirm: boolean): void {
      if (step === 'left') cursor.col = Math.max(0, cursor.col - 1);
      if (step === 'right') cursor.col = Math.min(2, cursor.col + 1);
      if (step === 'up') cursor.row = Math.max(0, cursor.row - 1);
      if (step === 'down') cursor.row = Math.min(2, cursor.row + 1);
      cursorSprite.setPosition(...boardPixel(cursor.col, cursor.row));
      if (!confirm) return;
      if (!selected) { selected = { ...cursor }; lastAction = 'select'; return; }
      const adjacent = Math.abs(selected.col - cursor.col) + Math.abs(selected.row - cursor.row) === 1;
      if (adjacent) {
        const a = matchBoard[selected.row]![selected.col]!;
        matchBoard[selected.row]![selected.col] = matchBoard[cursor.row]![cursor.col]!;
        matchBoard[cursor.row]![cursor.col] = a;
        boardRevision += 1; lastAction = 'swap'; resolveMatches();
      }
      selected = null;
    }

    function setupMatch(): void {
      cursor = { col: 1, row: 0 };
      paddle.setVisible(false); opponent.setVisible(false); ball.setVisible(false);
      drawMatchBoard();
    }

    function setupFalling(): void {
      matchBoard = Array.from({ length: 8 }, () => Array(6).fill(-1) as number[]);
      matchBoard[7] = [1, 1, -1, -1, 1, 1];
      cursorSprite.setVisible(false); paddle.setVisible(false); opponent.setVisible(false); ball.setVisible(false);
    }

    function fallingCells(): readonly { col: number; row: number }[] {
      return pieceRotated ? [{ col: pieceCol, row: pieceRow }, { col: pieceCol, row: pieceRow + 1 }] : [{ col: pieceCol, row: pieceRow }, { col: pieceCol + 1, row: pieceRow }];
    }

    function fallingBlocked(nextRow: number): boolean {
      const cells = pieceRotated ? [{ col: pieceCol, row: nextRow }, { col: pieceCol, row: nextRow + 1 }] : [{ col: pieceCol, row: nextRow }, { col: pieceCol + 1, row: nextRow }];
      return cells.some((cell) => cell.row >= 8 || cell.col < 0 || cell.col >= 6 || matchBoard[cell.row]?.[cell.col] !== -1);
    }

    function drawFalling(): void {
      clearBoardSprites();
      for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
        const occupied = matchBoard[row]![col]! >= 0 || fallingCells().some((cell) => cell.col === col && cell.row === row);
        const [x, y] = [275 + col * 42, 105 + row * 42];
        boardSprites.push(scene.add.rectangle(x, y, 36, 36, 0x202532, occupied ? 0.5 : 0.28).setStrokeStyle(1, 0xffffff, occupied ? 0.18 : 0.08));
        if (occupied && boardRoleTextureKey) {
          boardRoleSprites.push(scene.add.sprite(x, y, boardRoleTextureKey).setDisplaySize(31, 31).setTint(0x65d0a8).setAlpha(0.9));
        }
      }
    }

    function lockFalling(): void {
      for (const cell of fallingCells()) if (cell.row >= 0 && cell.row < 8 && cell.col >= 0 && cell.col < 6) matchBoard[cell.row]![cell.col] = 2;
      const full = matchBoard[7]!.every((value) => value >= 0);
      if (full) { matchBoard.splice(7, 1); matchBoard.unshift(Array(6).fill(-1)); linesCleared += 1; score += 100; outcome = 'complete'; lastAction = 'line-clear'; }
      pieceRow = 0; pieceCol = 2; pieceRotated = false; drawFalling();
    }

    function setupBricks(): void {
      cursorSprite.setVisible(false); opponent.setVisible(false);
      paddle.setVisible(true); ball.setVisible(true); paddle.setPosition(paddleX, paddleY); ball.setPosition(ballX, ballY);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 6; col++) {
        const brick = scene.add.sprite(260 + col * 82, 105 + row * 38, context.assets.resolve('enemy')).setDisplaySize(70, 24);
        brickSprites.push(brick); objects.push(brick); bricksRemaining += 1;
      }
    }

    function setupPong(): void {
      avatar.setVisible(false); cursorSprite.setVisible(false); paddle.setVisible(true); ball.setVisible(true);
      paddle.setDisplaySize(22, 110).setPosition(55, height / 2); paddleY = height / 2; opponent.setVisible(true); ball.setPosition(width / 2, height / 2); ballVx = 210; ballVy = 145;
    }

    function setupPhysicsPuzzle(): void {
      cursorSprite.setPosition(300, 300); paddle.setVisible(false); opponent.setVisible(false); ballX = 320; ballY = 300; ball.setPosition(ballX, ballY); ballVx = 0; ballVy = 0;
      const platform = scene.add.sprite(500, 360, context.assets.resolve('platform')).setDisplaySize(360, 28).setAlpha(0.9); objects.push(platform);
      const hazard = scene.add.sprite(560, 300, context.assets.resolve('hazard')).setDisplaySize(44, 44).setAlpha(0.95); objects.push(hazard);
      const goal = scene.add.sprite(770, 300, context.assets.resolve('exit')).setDisplaySize(48, 70); objects.push(goal);
    }

    function setupMaze(): void {
      paddle.setVisible(false); opponent.setVisible(false); ball.setVisible(false); cursorSprite.setVisible(false); mazeCell = { col: 0, row: 0 };
      avatar.setPosition(170, 135);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
        const wall = mazeWalls.has(col + ',' + row);
        const tile = scene.add.sprite(170 + col * 62, 135 + row * 62, context.assets.resolve(wall ? 'platform' : 'pickup')).setDisplaySize(52, 52).setAlpha(wall ? 0.7 : 0.12);
        objects.push(tile);
      }
    }

    function setupTiming(): void { cursorSprite.setVisible(false); paddle.setVisible(false); opponent.setVisible(false); ball.setVisible(false); avatar.setPosition(width / 2, 180); }

    function setupPinball(): void {
      cursorSprite.setVisible(false); opponent.setVisible(false); paddle.setDisplaySize(130, 18).setPosition(width / 2, height - 48); ballX = width / 2; ballY = height - 85; ball.setPosition(ballX, ballY); ballVx = 125; ballVy = -250; launched = false;
      for (const point of [{ x: 620, y: 220 }, { x: 570, y: 220 }, { x: 480, y: 330 }]) { const bumper = scene.add.sprite(point.x, point.y, context.assets.resolve('hazard')).setDisplaySize(46, 46); bumperSprites.push(bumper); objects.push(bumper); }
    }

    if (VARIANT === 'match-puzzle') setupMatch();
    else if (VARIANT === 'falling-block-puzzle') { setupFalling(); drawFalling(); }
    else if (VARIANT === 'breakout') setupBricks();
    else if (VARIANT === 'pong') setupPong();
    else if (VARIANT === 'physics-puzzle') setupPhysicsPuzzle();
    else if (VARIANT === 'maze-game') setupMaze();
    else if (VARIANT === 'pinball-lite') setupPinball();
    else setupTiming();

    function updateBreakout(deltaMs: number): void {
      const move = context.input.axis('MOVE_LEFT', 'MOVE_RIGHT'); paddleX = Phaser.Math.Clamp(paddleX + move * 290 * deltaMs / 1000, 75, width - 75); paddle.setX(paddleX);
      ballX += ballVx * deltaMs / 1000; ballY += ballVy * deltaMs / 1000;
      if (ballX < 12 || ballX > width - 12) ballVx *= -1;
      if (ballY < 50) ballVy = Math.abs(ballVy);
      if (ballY > paddleY - 22 && ballY < paddleY + 12 && Math.abs(ballX - paddleX) < 75 && ballVy > 0) { ballVy = -Math.abs(ballVy); ballVx += move * 40; lastAction = 'paddle-return'; }
      for (const brick of brickSprites) if (brick.visible && Math.abs(ballX - brick.x) < 42 && Math.abs(ballY - brick.y) < 22) { brick.setVisible(false); bricksRemaining -= 1; score += 10; ballVy *= -1; lastAction = 'brick'; }
      if (ballY > height + 20) { lives -= 1; if (lives <= 0) outcome = 'failed'; else { ballX = width / 2; ballY = height / 2; ballVy = -180; } }
      if (bricksRemaining === 0) outcome = 'complete';
      ball.setPosition(ballX, ballY);
    }

    function updatePong(deltaMs: number): void {
      const move = context.input.axis('MOVE_UP', 'MOVE_DOWN'); paddleY = Phaser.Math.Clamp(paddleY + move * 260 * deltaMs / 1000, 70, height - 70); paddle.setY(paddleY);
      opponentY = Phaser.Math.Linear(opponentY, ballY, Math.min(1, deltaMs / 300)); opponent.setY(opponentY);
      ballX += ballVx * deltaMs / 1000; ballY += ballVy * deltaMs / 1000;
      if (ballY < 18 || ballY > height - 18) ballVy *= -1;
      if (ballX < 75 && ballX > 35 && Math.abs(ballY - paddleY) < 70 && ballVx < 0) { ballVx = Math.abs(ballVx) + 8; lastAction = 'player-return'; }
      if (ballX > width - 75 && ballX < width - 35 && Math.abs(ballY - opponentY) < 70 && ballVx > 0) ballVx = -Math.abs(ballVx) - 8;
      if (ballX < -20) { opponentScore += 1; ballX = width / 2; ballY = height / 2; ballVx = 210; }
      if (ballX > width + 20) { playerScore += 1; ballX = width / 2; ballY = height / 2; ballVx = -210; }
      if (playerScore >= 3) outcome = 'complete'; if (opponentScore >= 3) outcome = 'failed'; ball.setPosition(ballX, ballY);
    }

    function updatePhysicsPuzzle(deltaMs: number): void {
      const pointer = context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM');
      if (pointer && !triggerActivated) { triggerActivated = true; ballVx = 175; ballVy = -90; lastAction = 'trigger'; }
      if (triggerActivated && !goalReached) {
        ballX += ballVx * deltaMs / 1000; ballY += ballVy * deltaMs / 1000; ballVy += 150 * deltaMs / 1000;
        if (ballY >= 330 && ballVx > 0) { ballY = 330; ballVy = -Math.abs(ballVy); collisionBounces += 1; lastAction = 'platform-bounce'; }
        if (!hazardResolved && ballX >= 538 && ballX <= 582 && Math.abs(ballY - 300) < 42) { hazardResolved = true; collisionBounces += 1; score += 10; lastAction = 'hazard-bounce'; }
        if (ballX >= 745) { goalReached = true; outcome = 'complete'; score = 100; lastAction = 'goal'; }
        ball.setPosition(ballX, ballY);
      }
    }

    function updateMaze(step: 'up' | 'down' | 'left' | 'right' | null): void {
      if (!step) return; const next = { ...mazeCell };
      if (step === 'left') next.col -= 1; if (step === 'right') next.col += 1; if (step === 'up') next.row -= 1; if (step === 'down') next.row += 1;
      const valid = next.col >= 0 && next.col < 5 && next.row >= 0 && next.row < 5 && !mazeWalls.has(next.col + ',' + next.row);
      if (!valid) { lastAction = 'wall'; return; }
      mazeCell = next; avatar.setPosition(170 + mazeCell.col * 62, 135 + mazeCell.row * 62); lastAction = 'move';
      if (mazeCell.col === 0 && mazeCell.row === 4) mazeHasPickup = true;
      if (mazeCell.col === 4 && mazeCell.row === 4) outcome = 'complete';
    }

    function updateRhythm(): void {
      const cycle = Math.floor(elapsedMs / 500); beatWindowOpen = elapsedMs % 500 >= 190 && elapsedMs % 500 <= 310;
      beatIndex = Math.min(8, cycle);
      if (context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM')) {
        if (beatWindowOpen) { beatHits += 1; score += 100; lastAction = 'hit'; if (particleTextureKey) { const particle = scene.add.sprite(720, 105, particleTextureKey).setDisplaySize(24, 24).setAlpha(0.95); particles.push(particle); particleEffects += 1; } }
        else { beatMisses += 1; lastAction = 'miss'; }
      }
      if (beatIndex >= 8) outcome = 'complete';
    }

    function updateReaction(): void {
      if (!reactionSignal && elapsedMs >= reactionSignalAt + 900) { reactionSignal = true; reactionSignalAt = elapsedMs; lastAction = 'signal'; }
      if (context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM')) {
        if (!reactionSignal) { falseStarts += 1; lastAction = 'false-start'; reactionSignalAt = elapsedMs; }
        else { reactionTimes.push(Math.round(elapsedMs - reactionSignalAt)); reactionRound += 1; reactionSignal = false; reactionSignalAt = elapsedMs; lastAction = 'reaction'; if (reactionRound >= 3) outcome = 'complete'; }
      }
    }

    function updatePinball(deltaMs: number): void {
      const move = context.input.axis('MOVE_LEFT', 'MOVE_RIGHT'); paddleX = Phaser.Math.Clamp(paddleX + move * 260 * deltaMs / 1000, 80, width - 80); paddle.setX(paddleX);
      if (!launched && (context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM'))) { launched = true; lastAction = 'launch'; }
      if (!launched) return;
      ballX += ballVx * deltaMs / 1000; ballY += ballVy * deltaMs / 1000; ballVy += 110 * deltaMs / 1000;
      if (ballX < 18 || ballX > width - 18) ballVx *= -1; if (ballY < 55) ballVy = Math.abs(ballVy);
      for (const bumper of bumperSprites) if (Phaser.Math.Distance.Between(ballX, ballY, bumper.x, bumper.y) < 38) { ballVy = -Math.abs(ballVy) - 40; ballVx += (ballX - bumper.x) * 2; score += 25; bumperHits += 1; lastAction = 'bumper'; if (particleTextureKey) { const particle = scene.add.sprite(bumper.x, bumper.y, particleTextureKey).setDisplaySize(28, 28).setAlpha(0.95); particles.push(particle); particleEffects += 1; } }
      if (ballY > paddleY - 25 && ballY < paddleY + 15 && Math.abs(ballX - paddleX) < 75 && ballVy > 0) ballVy = -Math.abs(ballVy) - 60;
      if (ballY > height + 20) { drains += 1; lives -= 1; if (lives <= 0) outcome = 'complete'; else { launched = false; ballX = width / 2; ballY = height - 85; ballVx = 125; ballVy = -250; } }
      ball.setPosition(ballX, ballY);
    }

    function render(): void {
      status.setText(VARIANT + ' | score ' + score + ' | ' + lastAction + (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''));
      if (VARIANT === 'reaction-timing') avatar.setTint(reactionSignal ? 0x65d0a8 : 0xe05fa0); else if (VARIANT === 'rhythm-action') avatar.setTint(beatWindowOpen ? 0x65d0a8 : 0x6b7280);
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT, family: 'puzzle-arcade', playerTextureKey: avatar.texture.key, backgroundTextureKey: background ? background.texture.key : null,
      cursorTextureKey: cursorSprite.texture.key, cursorRoleSource, panelTextureKey: rolePanel?.texture.key ?? null, panelRoleSource,
      buttonTextureKey: button?.texture.key ?? null, buttonRoleSource, particleTextureKey,
      boardRoleTextureKey, boardRoleSource, boardRoleSpriteCount: boardRoleSprites.filter((sprite) => sprite.visible).length,
      avatarVisible: avatar.visible, cursorVisible: cursorSprite.visible, paddleVisible: paddle.visible, opponentVisible: opponent.visible, ballVisible: ball.visible,
      unexpectedDecorationVisible: VARIANT === 'match-puzzle' || VARIANT === 'falling-block-puzzle'
        ? paddle.visible || opponent.visible || ball.visible
        : VARIANT === 'pong' ? avatar.visible || cursorSprite.visible : false,
      elapsedMs: Math.round(elapsedMs), score, outcome, lastAction, cursor, selected, boardRevision, matchesCleared, collisionBounces, particleEffects, launched,
      pieceRow, pieceCol, pieceRotated, linesCleared, paddleX: Math.round(paddleX), paddleY: Math.round(paddleY), ballX: Math.round(ballX), ballY: Math.round(ballY),
      bricksRemaining, lives, playerScore, opponentScore, triggerActivated, goalReached, mazeCell, mazeHasPickup,
      beatIndex, beatHits, beatMisses, beatWindowOpen, reactionRound, reactionSignal, reactionTimes, falseStarts, bumperHits, drains,
    }));

    let dropMs = 0; let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return; elapsedMs += deltaMs; for (const particle of particles) particle.setAlpha(Math.max(0, particle.alpha - deltaMs / 500));
        if (VARIANT === 'match-puzzle') { const intent = gridController.read(context.input); matchInput(intent.step, intent.confirmPressed); }
        else if (VARIANT === 'falling-block-puzzle') {
          const intent = gridController.read(context.input); if (intent.step === 'left') pieceCol = Math.max(0, pieceCol - 1); if (intent.step === 'right') pieceCol = Math.min(pieceRotated ? 5 : 4, pieceCol + 1); if (intent.confirmPressed || context.input.justPressed('PRIMARY_ACTION')) pieceRotated = !pieceRotated;
          dropMs += deltaMs; if (dropMs >= 380) { dropMs = 0; if (fallingBlocked(pieceRow + 1)) lockFalling(); else pieceRow += 1; } drawFalling();
        } else if (VARIANT === 'breakout') updateBreakout(deltaMs);
        else if (VARIANT === 'pong') updatePong(deltaMs);
        else if (VARIANT === 'physics-puzzle') updatePhysicsPuzzle(deltaMs);
        else if (VARIANT === 'maze-game') updateMaze(gridController.read(context.input).step);
        else if (VARIANT === 'rhythm-action') updateRhythm();
        else if (VARIANT === 'reaction-timing') updateReaction();
        else updatePinball(deltaMs);
        render();
      },
      dispose(): void { if (disposed) return; disposed = true; debugHandle.dispose(); try { background?.destroy(); avatar.destroy(); status.destroy(); clearBoardSprites(); for (const object of objects) object.destroy(); } catch { /* scene teardown */ } },
    };
  },
};
`;
}

export function puzzleArcadeStarterKit(variant: PuzzleArcadeStarterVariant) {
  const base = defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-puzzle-arcade',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 70, y: 70, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
  const roles = variant === 'match-puzzle' ? ['ui.panel', 'ui.cursor'] as const
    : variant === 'physics-puzzle' ? ['ui.cursor'] as const
    : variant === 'rhythm-action' ? ['ui.panel', 'ui.button', 'particle'] as const
    : variant === 'pinball-lite' ? ['ui.panel', 'particle'] as const
    : [] as const;
  return roles.length > 0 ? withDefaultThemeRoles(base, roles) : base;
}
