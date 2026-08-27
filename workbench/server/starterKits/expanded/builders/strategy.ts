import { defineExpandedKit } from './common.ts';

export type StrategyStarterVariant =
  | 'lane-defense'
  | 'auto-battler'
  | 'simple-rts'
  | 'turn-based-tactics'
  | 'base-defense'
  | 'territory-control';

function shellSource(variant: StrategyStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const CELL = 64;
const COLS = 12;
const ROWS = 7;
const ORIGIN_X = 96;
const ORIGIN_Y = 70;

type Cell = { col: number; row: number };
interface Unit { sprite: Phaser.GameObjects.Sprite; cell: Cell; hp: number; alive: boolean; }

function same(a: Cell, b: Cell): boolean { return a.col === b.col && a.row === b.row; }
function distance(a: Cell, b: Cell): number { return Math.abs(a.col - b.col) + Math.abs(a.row - b.row); }

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-strategy-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const decorations: Phaser.GameObjects.GameObject[] = [];
    const resolveOptional = (role: Parameters<typeof context.assets.has>[0], fallback: Parameters<typeof context.assets.resolve>[0]): string => context.assets.has(role) ? context.assets.resolve(role) : context.assets.resolve(fallback);

    const toPixel = (cell: Cell): [number, number] => [ORIGIN_X + cell.col * CELL, ORIGIN_Y + cell.row * CELL];
    const zoneForCol = (col: number): number => col < 4 ? 0 : col < 8 ? 1 : 2;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = scene.add.sprite(...toPixel({ col, row }), context.assets.resolve('platform')).setDisplaySize(CELL - 8, CELL - 8).setAlpha(0.12);
        decorations.push(tile);
      }
    }

    let cursor: Cell = { col: 2, row: 3 };
    const cursorTexture =
      VARIANT === 'simple-rts' ? resolveOptional('ui.cursor', 'checkpoint') :
      VARIANT === 'auto-battler' ? resolveOptional('ui.button', 'pickup') :
      context.assets.resolve('checkpoint');
    const cursorSprite = scene.add.sprite(...toPixel(cursor), cursorTexture).setDisplaySize(CELL - 14, CELL - 14).setAlpha(0.7);
    const playerUnit: Unit = { sprite: scene.add.sprite(...toPixel({ col: 2, row: 3 }), context.assets.resolve('player')).setDisplaySize(42, 42), cell: { col: 2, row: 3 }, hp: 4, alive: true };
    const enemies: Unit[] = [];
    let rtsObjectiveMarker: Phaser.GameObjects.Sprite | null = null;
    let autoPanel: Phaser.GameObjects.Sprite | null = null;
    let autoButton: Phaser.GameObjects.Sprite | null = null;
    let autoSetupMarker: Phaser.GameObjects.Sprite | null = null;
    const territoryPanels: Phaser.GameObjects.Sprite[] = [];

    function spawnEnemy(col: number, row: number, hp = 2): Unit {
      const unit: Unit = { sprite: scene.add.sprite(...toPixel({ col, row }), context.assets.resolve('enemy')).setDisplaySize(38, 38), cell: { col, row }, hp, alive: true };
      enemies.push(unit);
      return unit;
    }
    if (VARIANT === 'turn-based-tactics') {
      spawnEnemy(4, 3, 2);
      spawnEnemy(5, 3, 2);
    } else if (VARIANT === 'territory-control') {
      spawnEnemy(5, 2, 2);
      spawnEnemy(9, 4, 2);
    } else {
      spawnEnemy(8, 2, VARIANT === 'base-defense' ? 3 : 2);
      spawnEnemy(9, 4, 2);
    }

    if (VARIANT === 'simple-rts') {
      const finalEnemy = enemies[1];
      if (finalEnemy) {
        rtsObjectiveMarker = scene.add.sprite(...toPixel(finalEnemy.cell), context.assets.resolve('checkpoint')).setDisplaySize(52, 52).setAlpha(0.4);
        decorations.push(rtsObjectiveMarker);
      }
    }
    if (VARIANT === 'auto-battler') {
      autoPanel = scene.add.sprite(width - 160, 82, resolveOptional('ui.panel', 'platform')).setDisplaySize(260, 82).setAlpha(0.32);
      autoButton = scene.add.sprite(width - 74, 82, resolveOptional('ui.button', 'checkpoint')).setDisplaySize(72, 34).setAlpha(0.85);
      autoSetupMarker = scene.add.sprite(...toPixel(cursor), context.assets.resolve('pickup')).setDisplaySize(20, 20).setAlpha(0.9);
      decorations.push(autoPanel, autoButton, autoSetupMarker);
    }
    if (VARIANT === 'territory-control') {
      const panelTexture = resolveOptional('ui.panel', 'platform');
      for (let zone = 0; zone < 3; zone++) {
        const panel = scene.add.sprite(...toPixel({ col: zone * 4 + 2, row: 6 }), panelTexture).setDisplaySize(CELL * 3.2, 42).setAlpha(0.28);
        territoryPanels.push(panel);
        decorations.push(panel);
      }
    }

    let turn: 'player' | 'enemy' = 'player';
    let turnsCompleted = 0;
    let lastAction = 'spawn';
    let outcome: 'playing' | 'victory' | 'defeat' = 'playing';
    let baseHealth = 6;
    let defenderLane: number | null = null;
    let defenderSprite: Phaser.GameObjects.Sprite | null = null;
    let laneWaveProgress = 0;
    let defenderAttackMs = 0;
    let autoBattleStarted = false;
    let autoTickMs = 0;
    let rtsTarget: Cell | null = null;
    let selected = false;
    let zones = [0, 0, 0];
    let captureProgress = [0, 0, 0];
    let holdScore = 0;
    let elapsedMs = 0;

    const status = scene.add.text(18, 16, '', { fontFamily: 'ui-monospace, monospace', fontSize: '15px', color: '#ffffff', backgroundColor: '#111827aa', padding: { x: 8, y: 5 } }).setDepth(50);

    function liveEnemies(): Unit[] { return enemies.filter((enemy) => enemy.alive); }
    function contestedZones(): boolean[] {
      return [0, 1, 2].map((zone) => liveEnemies().some((enemy) => zoneForCol(enemy.cell.col) === zone));
    }
    function sync(unit: Unit): void { unit.sprite.setPosition(...toPixel(unit.cell)); unit.sprite.setVisible(unit.alive); }
    function moveCursor(step: 'up' | 'down' | 'left' | 'right'): void {
      if (step === 'up') cursor = { col: cursor.col, row: Math.max(0, cursor.row - 1) };
      if (step === 'down') cursor = { col: cursor.col, row: Math.min(ROWS - 1, cursor.row + 1) };
      if (step === 'left') cursor = { col: Math.max(0, cursor.col - 1), row: cursor.row };
      if (step === 'right') cursor = { col: Math.min(COLS - 1, cursor.col + 1), row: cursor.row };
      cursorSprite.setPosition(...toPixel(cursor));
      autoSetupMarker?.setPosition(...toPixel(cursor));
    }
    function damage(unit: Unit, amount = 1): void {
      unit.hp -= amount;
      if (unit.hp <= 0) {
        unit.alive = false;
        unit.sprite.setVisible(false);
        if (VARIANT === 'simple-rts' && unit === enemies[1]) rtsObjectiveMarker?.setVisible(false);
      }
    }

    function enemyTurn(): void {
      const enemy = liveEnemies()[0];
      if (!enemy) { outcome = 'victory'; turn = 'player'; return; }
      if (distance(enemy.cell, playerUnit.cell) <= 1) {
        damage(playerUnit, 1);
        lastAction = 'enemy-attack';
        if (!playerUnit.alive) outcome = 'defeat';
      } else {
        const dx = Math.sign(playerUnit.cell.col - enemy.cell.col);
        const dy = Math.sign(playerUnit.cell.row - enemy.cell.row);
        if (Math.abs(playerUnit.cell.col - enemy.cell.col) >= Math.abs(playerUnit.cell.row - enemy.cell.row)) enemy.cell = { col: enemy.cell.col + dx, row: enemy.cell.row };
        else enemy.cell = { col: enemy.cell.col, row: enemy.cell.row + dy };
        sync(enemy);
        lastAction = 'enemy-move';
      }
      turnsCompleted += 1;
      turn = 'player';
    }

    function tacticsInput(confirmPressed: boolean): void {
      if (turn !== 'player') return;
      if (context.input.justPressed('PRIMARY_ACTION')) {
        const enemy = liveEnemies().find((candidate) => same(candidate.cell, cursor));
        if (enemy && distance(playerUnit.cell, enemy.cell) <= 1) {
          damage(enemy, 2);
          lastAction = 'player-attack';
          if (liveEnemies().length === 0) outcome = 'victory';
          else turn = 'enemy';
        }
      } else if (confirmPressed && distance(playerUnit.cell, cursor) === 1 && !liveEnemies().some((enemy) => same(enemy.cell, cursor))) {
        playerUnit.cell = { ...cursor };
        sync(playerUnit);
        lastAction = 'player-move';
        turn = 'enemy';
      }
    }

    function laneDefense(confirmPressed: boolean, deltaMs: number): void {
      if (confirmPressed) {
        defenderLane = cursor.row % 3;
        const defenderCell = { col: 4, row: 2 + defenderLane };
        if (!defenderSprite) {
          defenderSprite = scene.add.sprite(...toPixel(defenderCell), context.assets.resolve('pickup')).setDisplaySize(36, 36);
          decorations.push(defenderSprite);
        } else {
          defenderSprite.setPosition(...toPixel(defenderCell));
        }
        lastAction = 'place-defender';
      }
      laneWaveProgress += deltaMs * 0.035;
      defenderAttackMs = Math.max(0, defenderAttackMs - deltaMs);
      for (const enemy of liveEnemies()) {
        enemy.cell.col = Math.max(0, 9 - Math.floor(laneWaveProgress / 100) % 10);
        enemy.cell.row = 2 + (enemies.indexOf(enemy) % 3);
        sync(enemy);
        if (enemy.cell.col === 0 && enemy.alive) { enemy.alive = false; baseHealth -= 2; }
      }
      if (defenderLane !== null && defenderAttackMs <= 0) {
        const target = liveEnemies().find((enemy) => enemy.cell.row - 2 === defenderLane);
        if (target) {
          damage(target, 1);
          defenderAttackMs = 650;
        }
      }
      if (baseHealth <= 0) outcome = 'defeat';
      else if (liveEnemies().length === 0) outcome = 'victory';
    }

    function autoBattler(confirmPressed: boolean, deltaMs: number): void {
      if (!autoBattleStarted && confirmPressed) {
        autoBattleStarted = true;
        lastAction = 'start-battle';
        autoButton?.setTint(0x65d0a8);
        autoPanel?.setAlpha(0.48);
      }
      if (!autoBattleStarted) return;
      autoTickMs += deltaMs;
      if (autoTickMs < 700) return;
      autoTickMs = 0;
      const enemy = liveEnemies()[0];
      if (!enemy) { outcome = 'victory'; return; }
      damage(enemy, 1 + (cursor.col % 2));
      if (enemy.alive) damage(playerUnit, 1);
      if (!playerUnit.alive) outcome = 'defeat';
      lastAction = 'auto-round';
    }

    function simpleRts(confirmPressed: boolean, deltaMs: number): void {
      if (confirmPressed && !selected) { selected = true; lastAction = 'select'; return; }
      if (confirmPressed && selected) { rtsTarget = { ...cursor }; lastAction = 'command'; }
      if (rtsTarget && !same(playerUnit.cell, rtsTarget)) {
        const dx = Math.sign(rtsTarget.col - playerUnit.cell.col);
        const dy = Math.sign(rtsTarget.row - playerUnit.cell.row);
        if (elapsedMs % 250 < deltaMs) playerUnit.cell = { col: playerUnit.cell.col + dx, row: playerUnit.cell.row + (dx === 0 ? dy : 0) };
        sync(playerUnit);
      }
      const enemy = liveEnemies().find((candidate) => distance(candidate.cell, playerUnit.cell) <= 1);
      if (enemy && context.input.justPressed('PRIMARY_ACTION')) damage(enemy, 2);
      if (liveEnemies().length === 0) outcome = 'victory';
    }

    function baseDefense(deltaMs: number): void {
      for (const enemy of liveEnemies()) {
        if (elapsedMs % 350 < deltaMs) enemy.cell.col = Math.max(1, enemy.cell.col - 1);
        sync(enemy);
        if (enemy.cell.col <= 1) { enemy.alive = false; baseHealth -= 2; }
      }
      if (context.input.justPressed('PRIMARY_ACTION')) {
        const enemy = liveEnemies()[0];
        if (enemy) damage(enemy, 1);
      }
      if (baseHealth <= 0) outcome = 'defeat'; else if (liveEnemies().length === 0) outcome = 'victory';
    }

    function territory(confirmPressed: boolean, deltaMs: number): void {
      const zoneIndex = zoneForCol(cursor.col);
      const contested = contestedZones();
      if (confirmPressed) {
        captureProgress[zoneIndex] = captureProgress[zoneIndex]! + (contested[zoneIndex] ? 22 : 35);
        lastAction = contested[zoneIndex] ? 'capture-contested' : 'capture';
      }
      for (let i = 0; i < captureProgress.length; i++) {
        const activeGain = contested[i] ? deltaMs * 0.001 : deltaMs * 0.006;
        captureProgress[i] = Phaser.Math.Clamp(captureProgress[i]! + (i === zoneIndex ? activeGain : -deltaMs * 0.002), 0, 100);
        if (captureProgress[i]! >= 100) zones[i] = 1;
        const panel = territoryPanels[i];
        if (panel) panel.setAlpha(zones[i] === 1 ? 0.68 : contested[i] ? 0.46 : 0.28);
      }
      holdScore += zones.filter((zone) => zone === 1).length * deltaMs / 1000;
      if (holdScore >= 8) outcome = 'victory';
    }

    function render(): void {
      status.setText(VARIANT + ' | turn ' + turn + ' | enemies ' + liveEnemies().length + ' | base ' + baseHealth + ' | ' + lastAction + (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''));
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'strategy-defense',
      playerTextureKey: playerUnit.sprite.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      cursorTextureKey: cursorSprite.texture.key,
      panelTextureKey: autoPanel?.texture.key ?? territoryPanels[0]?.texture.key ?? null,
      buttonTextureKey: autoButton?.texture.key ?? null,
      setupMarkerTextureKey: autoSetupMarker?.texture.key ?? null,
      objectiveTextureKey: rtsObjectiveMarker?.texture.key ?? null,
      cursor,
      playerCell: playerUnit.cell,
      playerHp: playerUnit.hp,
      turn,
      turnsCompleted,
      enemiesRemaining: liveEnemies().length,
      enemyStates: enemies.map((enemy) => ({ cell: enemy.cell, hp: enemy.hp, alive: enemy.alive })),
      lastAction,
      outcome,
      baseHealth,
      defenderLane,
      autoBattleStarted,
      setupPower: 1 + (cursor.col % 2),
      selected,
      rtsTarget,
      zones,
      captureProgress,
      contestedZones: contestedZones(),
      holdScore,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return;
        elapsedMs += deltaMs;
        const intent = gridController.read(context.input);
        if (intent.step) moveCursor(intent.step);

        if (VARIANT === 'turn-based-tactics') {
          tacticsInput(intent.confirmPressed);
          if (turn === 'enemy' && outcome === 'playing') enemyTurn();
        } else if (VARIANT === 'lane-defense') laneDefense(intent.confirmPressed, deltaMs);
        else if (VARIANT === 'auto-battler') autoBattler(intent.confirmPressed, deltaMs);
        else if (VARIANT === 'simple-rts') simpleRts(intent.confirmPressed, deltaMs);
        else if (VARIANT === 'base-defense') baseDefense(deltaMs);
        else territory(intent.confirmPressed, deltaMs);

        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy(); cursorSprite.destroy(); playerUnit.sprite.destroy(); status.destroy();
          for (const enemy of enemies) enemy.sprite.destroy();
          for (const object of decorations) object.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

export function strategyStarterKit(variant: StrategyStarterVariant) {
  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-strategy-starter',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 224, y: 262, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}