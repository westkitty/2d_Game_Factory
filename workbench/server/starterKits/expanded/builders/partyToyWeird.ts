import { defineExpandedKit } from './common.ts';
import { withDefaultThemeRoles } from './themeRoles.ts';

export type PartyToyStarterVariant =
  | 'microgame-collection'
  | 'local-party-game'
  | 'physics-toy'
  | 'virtual-pet'
  | 'dress-up-character-toy'
  | 'sandbox-playground'
  | 'drawing-game'
  | 'fishing-game'
  | 'cooking-game'
  | 'photography-game';

function shellSource(variant: PartyToyStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, topDownController, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const GRID_W = 8;
const GRID_H = 6;
const GRID_SIZE = 48;
const GRID_X = 300;
const GRID_Y = 120;

interface ToyBody { sprite: Phaser.GameObjects.Sprite; vx: number; vy: number; }

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-party-toy',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const hero = scene.add.sprite(width * 0.5, 190, context.assets.resolve('player')).setDisplaySize(92, 92);
    const cursorRoleSource = (VARIANT === 'drawing-game' || VARIANT === 'dress-up-character-toy' || VARIANT === 'microgame-collection' || VARIANT === 'photography-game' || VARIANT === 'physics-toy' || VARIANT === 'sandbox-playground') && context.assets.has('ui.cursor') ? 'ui.cursor' : 'checkpoint';
    const cursorSprite = scene.add.sprite(GRID_X, GRID_Y, context.assets.resolve(cursorRoleSource)).setDisplaySize(42, 42).setAlpha(0.7);
    const panelRoleSource = context.assets.has('ui.panel') ? 'ui.panel' : null;
    const rolePanel = panelRoleSource ? scene.add.sprite(width * 0.5, 45, context.assets.resolve('ui.panel')).setDisplaySize(690, 58).setAlpha(0.88).setDepth(80) : null;
    const buttonRoleSource = context.assets.has('ui.button') ? 'ui.button' : null;
    const roleButton = buttonRoleSource ? scene.add.sprite(width - 95, 45, context.assets.resolve('ui.button')).setDisplaySize(92, 42).setAlpha(0.92).setDepth(90) : null;
    const roleButtonLabel = buttonRoleSource ? scene.add.text(width - 95, 45, 'ACT', { fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#14251f' }).setOrigin(0.5).setDepth(91) : null;
    const status = scene.add.text(width * 0.5, 350, '', { fontFamily: 'ui-monospace, monospace', fontSize: '17px', color: '#ffffff', align: 'center', wordWrap: { width: 820 } }).setOrigin(0.5, 0).setDepth(100);
    const hint = scene.add.text(width * 0.5, 475, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#9fd7ff', align: 'center', wordWrap: { width: 820 } }).setOrigin(0.5).setDepth(100);
    const objects: Phaser.GameObjects.GameObject[] = [cursorSprite];
    const drawingMarks: Phaser.GameObjects.Sprite[] = [];
    const sandboxMarks: Phaser.GameObjects.Sprite[] = [];
    const particleSprites: Phaser.GameObjects.Sprite[] = [];
    const particleTextureKey = context.assets.has('particle') ? context.assets.resolve('particle') : null;
    const rolePickupSource = (VARIANT === 'cooking-game' || VARIANT === 'dress-up-character-toy' || VARIANT === 'fishing-game' || VARIANT === 'virtual-pet') ? 'pickup' : null;
    const rolePickup = rolePickupSource ? scene.add.sprite(210, 245, context.assets.resolve('pickup')).setDisplaySize(38, 38).setDepth(70) : null;
    const platformTextureKey = context.assets.has('platform') ? context.assets.resolve('platform') : null;
    const wardrobeLabels = VARIANT === 'dress-up-character-toy'
      ? scene.add.text(width * 0.5, 120, 'HAT       OUTFIT       COLOR', { fontFamily: 'ui-monospace, monospace', fontSize: '16px', color: '#e8ecf4' }).setOrigin(0.5).setDepth(90)
      : null;
    if (rolePickup) objects.push(rolePickup);
    if (rolePanel) objects.push(rolePanel);
    if (roleButton) objects.push(roleButton);
    if (roleButtonLabel) objects.push(roleButtonLabel);
    if (wardrobeLabels) objects.push(wardrobeLabels);

    let elapsedMs = 0;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let lastAction = 'spawn';
    let score = 0;

    let microgame = 0;
    let microProgress = 0;
    let microSignal = false;
    let microSignalAt = 0;
    const microScores = [0, 0, 0];

    let currentPlayer = 0;
    const partyScores = [0, 0];
    let partyTurns = 0;
    let winner: number | null = null;

    const toyBodies: ToyBody[] = [];
    let toySpawns = 0;
    let toyResets = 0;

    let hunger = 70;
    let happiness = 70;
    let petActions = 0;

    let wardrobeCategory = 0;
    const wardrobe = [0, 0, 0];
    let wardrobeChanges = 0;
    let dressResets = 0;

    let gridCursor = { col: 0, row: 0 };
    let sandboxKind = 0;
    const sandbox = new Map<string, number>();
    let sandboxResets = 0;
    const drawing = new Set<string>();
    let drawingResets = 0;

    let fishingState: 'idle' | 'cast' | 'bite' | 'landed' = 'idle';
    let fishingStateAt = 0;
    let fishCaught = 0;
    let fishMissed = 0;
    let particleEffects = 0;

    const recipe = [0, 1, 2];
    let recipeStep = 0;
    let cookingSelection = 0;
    let cookingMistakes = 0;
    let dishScore = 100;

    let photoTarget = 0;
    let photosTaken = 0;
    let bestPhoto = 0;
    const photoTargets: Phaser.GameObjects.Sprite[] = [];

    function gridPixel(col: number, row: number): [number, number] { return [GRID_X + col * GRID_SIZE, GRID_Y + row * GRID_SIZE]; }
    function syncCursor(): void { cursorSprite.setPosition(...gridPixel(gridCursor.col, gridCursor.row)); }
    function moveGrid(step: 'up' | 'down' | 'left' | 'right' | null): void {
      if (step === 'left') gridCursor.col = Math.max(0, gridCursor.col - 1);
      if (step === 'right') gridCursor.col = Math.min(GRID_W - 1, gridCursor.col + 1);
      if (step === 'up') gridCursor.row = Math.max(0, gridCursor.row - 1);
      if (step === 'down') gridCursor.row = Math.min(GRID_H - 1, gridCursor.row + 1);
      syncCursor();
    }

    function emitParticle(x: number, y: number, tint: number): void {
      if (!particleTextureKey) return;
      const particle = scene.add.sprite(x, y, particleTextureKey).setDisplaySize(18, 18).setTint(tint).setDepth(95);
      objects.push(particle); particleSprites.push(particle); particleEffects += 1;
    }

    function setupToy(): void {
      hero.setPosition(170, 250); cursorSprite.setVisible(true).setPosition(300, 250);
      if (platformTextureKey) { const ground = scene.add.sprite(width * 0.5, height - 28, platformTextureKey).setDisplaySize(width - 80, 34).setAlpha(0.35); objects.push(ground); }
      for (let i = 0; i < 3; i++) {
        const sprite = scene.add.sprite(400 + i * 90, 210 + i * 45, context.assets.resolve(i === 2 ? 'hazard' : 'pickup')).setDisplaySize(34, 34);
        objects.push(sprite); toyBodies.push({ sprite, vx: 35 + i * 18, vy: -10 + i * 8 });
      }
    }

    function resetToy(): void {
      toyBodies.forEach((body, index) => { body.sprite.setPosition(400 + index * 90, 210 + index * 45); body.vx = 35 + index * 18; body.vy = -10 + index * 8; });
      toyResets += 1; lastAction = 'reset';
    }

    function setupGridToy(): void {
      hero.setVisible(false); status.setPosition(width * 0.5, 430); syncCursor();
      for (let row = 0; row < GRID_H; row++) for (let col = 0; col < GRID_W; col++) {
        const tile = scene.add.sprite(...gridPixel(col, row), context.assets.resolve('platform')).setDisplaySize(GRID_SIZE - 5, GRID_SIZE - 5).setAlpha(0.12);
        objects.push(tile);
      }
    }

    function setupMicrogame(): void {
      cursorSprite.setVisible(true).setPosition(width * 0.5, 250);
    }

    function setupDress(): void {
      hero.setPosition(480, 245); cursorSprite.setVisible(true).setPosition(360, 165);
    }

    function setupPhoto(): void {
      cursorSprite.setVisible(true); hero.setPosition(130, 270).setDisplaySize(48, 48); status.setPosition(width * 0.5, 420);
      for (const point of [{ x: 420, y: 150 }, { x: 650, y: 280 }, { x: 790, y: 400 }]) { const target = scene.add.sprite(point.x, point.y, context.assets.resolve('enemy')).setDisplaySize(44, 44); photoTargets.push(target); objects.push(target); }
      cursorSprite.setPosition(photoTargets[0]!.x, photoTargets[0]!.y);
    }

    if (VARIANT === 'microgame-collection') setupMicrogame();
    else if (VARIANT === 'physics-toy') setupToy();
    else if (VARIANT === 'sandbox-playground' || VARIANT === 'drawing-game') setupGridToy();
    else if (VARIANT === 'photography-game') setupPhoto();
    else if (VARIANT === 'dress-up-character-toy') setupDress();
    else cursorSprite.setVisible(false);

    function updateMicrogame(): void {
      if (microgame === 0) {
        if (!microSignal && elapsedMs - microSignalAt >= 900) { microSignal = true; microSignalAt = elapsedMs; cursorSprite.setPosition(600, 250); lastAction = 'micro-signal'; emitParticle(600, 250, 0xffe28a); }
        if (context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM')) {
          if (microSignal) { microScores[0] = Math.max(0, 1000 - Math.round(elapsedMs - microSignalAt)); microgame = 1; microProgress = 0; cursorSprite.setPosition(400, 250); lastAction = 'micro-one'; emitParticle(400, 250, 0x65d0a8); }
          else microScores[0] = 0;
        }
      } else if (microgame === 1) {
        const expected = microProgress % 2 === 0 ? 'MOVE_LEFT' : 'MOVE_RIGHT';
        if (context.input.justPressed(expected)) { microProgress += 1; lastAction = 'micro-two'; cursorSprite.setPosition(400 + microProgress * 24, 250); emitParticle(cursorSprite.x, cursorSprite.y, 0xffe28a); if (microProgress >= 4) { microScores[1]! = 400; microgame = 2; microProgress = 0; } }
      } else if (microgame === 2) {
        if (context.input.justPressed('PRIMARY_ACTION')) { microProgress += 1; lastAction = 'micro-three'; emitParticle(560, 250, 0x65d0a8); if (microProgress >= 4) { microScores[2] = 400; score = microScores.reduce((sum, value) => sum + value, 0); outcome = 'complete'; microgame = 3; } }
      }
    }

    function updateParty(): void {
      if (!context.input.justPressed('PRIMARY_ACTION') && !context.input.justPressed('CONFIRM')) return;
      const power = 1 + (partyTurns % 3);
      partyScores[currentPlayer] = (partyScores[currentPlayer] ?? 0) + power;
      partyTurns += 1; lastAction = 'party-turn'; currentPlayer = currentPlayer === 0 ? 1 : 0;
      if (partyTurns >= 6) { const p1 = partyScores[0] ?? 0; const p2 = partyScores[1] ?? 0; winner = p1 === p2 ? 0 : p1 > p2 ? 0 : 1; outcome = 'complete'; }
    }

    function updateToy(deltaMs: number): void {
      if (context.input.justPressed('PRIMARY_ACTION')) {
        const sprite = scene.add.sprite(hero.x + 80, hero.y, context.assets.resolve('pickup')).setDisplaySize(30, 30); objects.push(sprite); toyBodies.push({ sprite, vx: 150, vy: -80 }); toySpawns += 1; lastAction = 'spawn-object'; emitParticle(hero.x + 80, hero.y, 0xffe28a);
      }
      if (context.input.justPressed('SECONDARY_ACTION')) resetToy();
      for (const body of toyBodies) {
        body.vy += 70 * deltaMs / 1000; body.sprite.x += body.vx * deltaMs / 1000; body.sprite.y += body.vy * deltaMs / 1000;
        if (body.sprite.x < 20 || body.sprite.x > width - 20) body.vx *= -1;
        if (body.sprite.y > height - 45) { body.sprite.y = height - 45; body.vy = -Math.abs(body.vy) * 0.72; }
      }
    }

    function updatePet(deltaMs: number): void {
      hunger -= deltaMs * 0.003; happiness -= deltaMs * 0.0025;
      if (context.input.justPressed('PRIMARY_ACTION')) { hunger += 25; petActions += 1; lastAction = 'feed'; }
      if (context.input.justPressed('SECONDARY_ACTION')) { happiness += 25; petActions += 1; lastAction = 'play'; }
      hunger = Phaser.Math.Clamp(hunger, 0, 100); happiness = Phaser.Math.Clamp(happiness, 0, 100);
      hero.setScale((92 / hero.height) * (0.9 + happiness / 500));
      if (rolePickup) rolePickup.setPosition(hero.x + 76, hero.y).setTint(happiness >= 80 ? 0x65d0a8 : 0xf0c274);
      if (hunger >= 85 && happiness >= 85 && petActions >= 2) outcome = 'complete';
    }

    function updateDress(): void {
      const intent = uiSimulationController.read(context.input);
      if (intent.navigateLeftPressed) wardrobeCategory = Math.max(0, wardrobeCategory - 1);
      if (intent.navigateRightPressed) wardrobeCategory = Math.min(2, wardrobeCategory + 1);
      cursorSprite.setPosition(360 + wardrobeCategory * 120, 165);
      if (intent.confirmPressed || intent.primaryPressed) { wardrobe[wardrobeCategory] = ((wardrobe[wardrobeCategory] ?? 0) + 1) % 4; wardrobeChanges += 1; lastAction = 'wardrobe'; }
      if (context.input.justPressed('SECONDARY_ACTION')) { wardrobe.fill(0); dressResets += 1; lastAction = 'reset-look'; }
      const colors = [0xffffff, 0x65d0a8, 0xe05fa0, 0xf0c274];
      const hat = wardrobe[0] ?? 0; const outfit = wardrobe[1] ?? 0; const size = wardrobe[2] ?? 0; const selected = wardrobe[wardrobeCategory] ?? 0;
      hero.setTint(colors[hat] ?? colors[0]!); hero.setAngle((outfit - 1) * 4); hero.setScale((92 / hero.height) * (1 + size * 0.05));
      if (rolePickup) rolePickup.setPosition(hero.x + 76, hero.y).setTint(colors[selected] ?? colors[0]!);
      if (wardrobeChanges >= 4 && wardrobe.filter((value) => value > 0).length >= 2) outcome = 'complete';
    }

    function updateSandbox(): void {
      const intent = gridController.read(context.input); moveGrid(intent.step);
      if (context.input.justPressed('PRIMARY_ACTION')) { sandboxKind = sandboxKind === 0 ? 1 : 0; lastAction = 'toggle-kind'; }
      if (intent.confirmPressed) { const key = gridCursor.col + ',' + gridCursor.row; sandbox.set(key, sandboxKind); const sprite = scene.add.sprite(...gridPixel(gridCursor.col, gridCursor.row), context.assets.resolve(sandboxKind === 0 ? 'pickup' : 'hazard')).setDisplaySize(30, 30); objects.push(sprite); sandboxMarks.push(sprite); lastAction = 'place'; emitParticle(...gridPixel(gridCursor.col, gridCursor.row), sandboxKind === 0 ? 0x65d0a8 : 0xe05fa0); }
      if (context.input.justPressed('SECONDARY_ACTION')) { sandbox.clear(); for (const mark of sandboxMarks) mark.destroy(); sandboxMarks.length = 0; sandboxResets += 1; lastAction = 'reset'; }
      if (sandbox.size >= 3 && new Set(sandbox.values()).size >= 2) outcome = 'complete';
    }

    function updateDrawing(): void {
      const intent = gridController.read(context.input); moveGrid(intent.step);
      if (intent.confirmPressed || context.input.justPressed('PRIMARY_ACTION')) { const key = gridCursor.col + ',' + gridCursor.row; if (!drawing.has(key)) { drawing.add(key); const dot = scene.add.sprite(...gridPixel(gridCursor.col, gridCursor.row), context.assets.resolve('pickup')).setDisplaySize(24, 24); objects.push(dot); drawingMarks.push(dot); } lastAction = 'draw'; }
      if (context.input.justPressed('SECONDARY_ACTION')) { drawing.clear(); for (const mark of drawingMarks) mark.destroy(); drawingMarks.length = 0; drawingResets += 1; lastAction = 'clear'; }
      if (drawing.size >= 5) outcome = 'complete';
    }

    function updateFishing(): void {
      const primary = context.input.justPressed('PRIMARY_ACTION') || context.input.justPressed('CONFIRM');
      if (fishingState === 'idle' && primary) { fishingState = 'cast'; fishingStateAt = elapsedMs; lastAction = 'cast'; }
      else if (fishingState === 'cast' && elapsedMs - fishingStateAt >= 1200) { fishingState = 'bite'; fishingStateAt = elapsedMs; lastAction = 'bite'; }
      else if (fishingState === 'bite') {
        if (primary && elapsedMs - fishingStateAt <= 700) { fishingState = 'landed'; fishCaught += 1; score += 50; fishingStateAt = elapsedMs; lastAction = 'landed'; emitParticle(470, 255, 0xffe28a); }
        else if (elapsedMs - fishingStateAt > 700) { fishingState = 'idle'; fishMissed += 1; lastAction = 'missed'; emitParticle(470, 255, 0xe05fa0); }
      } else if (fishingState === 'landed' && elapsedMs - fishingStateAt >= 500) fishingState = 'idle';
      if (fishCaught >= 2) outcome = 'complete';
    }

    function updateCooking(): void {
      const intent = uiSimulationController.read(context.input);
      if (intent.navigateLeftPressed) cookingSelection = Math.max(0, cookingSelection - 1);
      if (intent.navigateRightPressed) cookingSelection = Math.min(2, cookingSelection + 1);
      if (intent.confirmPressed || intent.primaryPressed) {
        if (cookingSelection === recipe[recipeStep]) { recipeStep += 1; lastAction = 'correct-step'; emitParticle(210, 245, 0x65d0a8); }
        else { cookingMistakes += 1; dishScore = Math.max(0, dishScore - 20); lastAction = 'wrong-step'; emitParticle(210, 245, 0xe05fa0); }
        if (recipeStep >= recipe.length) { score = dishScore; outcome = 'complete'; lastAction = 'dish-complete'; }
      }
    }

    function updatePhoto(deltaMs: number): void {
      const intent = topDownController.read(context.input); hero.x = Phaser.Math.Clamp(hero.x + intent.moveX * 190 * deltaMs / 1000, 30, width - 30); hero.y = Phaser.Math.Clamp(hero.y + intent.moveY * 190 * deltaMs / 1000, 70, height - 70);
      if (context.input.justPressed('SECONDARY_ACTION')) { photoTarget = (photoTarget + 1) % photoTargets.length; cursorSprite.setPosition(photoTargets[photoTarget]!.x, photoTargets[photoTarget]!.y); lastAction = 'frame'; }
      if (intent.primaryPressed) { const target = photoTargets[photoTarget]!; const distance = Phaser.Math.Distance.Between(hero.x, hero.y, target.x, target.y); const photoScore = Math.max(0, Math.round(100 - distance / 5)); photosTaken += 1; bestPhoto = Math.max(bestPhoto, photoScore); score += photoScore; lastAction = 'capture'; emitParticle(target.x, target.y, photoScore >= 70 ? 0x65d0a8 : 0xe05fa0); if (photosTaken >= 2 && bestPhoto >= 70) outcome = 'complete'; }
    }

    function render(): void {
      if (VARIANT === 'microgame-collection') status.setText('Microgame ' + Math.min(3, microgame + 1) + '/3 · ' + microScores.join(' + ') + (outcome === 'complete' ? ' · total ' + score : ''));
      else if (VARIANT === 'local-party-game') status.setText('Player ' + (currentPlayer + 1) + ' turn · P1 ' + partyScores[0] + ' · P2 ' + partyScores[1] + (winner !== null ? ' · winner P' + (winner + 1) : ''));
      else if (VARIANT === 'physics-toy') status.setText('Moving objects ' + toyBodies.length + ' · spawned ' + toySpawns + ' · resets ' + toyResets);
      else if (VARIANT === 'virtual-pet') status.setText('Hunger ' + Math.round(hunger) + ' · happiness ' + Math.round(happiness) + ' · actions ' + petActions);
      else if (VARIANT === 'dress-up-character-toy') status.setText('Category ' + (wardrobeCategory + 1) + ' · look ' + wardrobe.join('/') + ' · changes ' + wardrobeChanges);
      else if (VARIANT === 'sandbox-playground') status.setText('Placed ' + sandbox.size + ' · kind ' + sandboxKind + ' · resets ' + sandboxResets);
      else if (VARIANT === 'drawing-game') status.setText('Marks ' + drawing.size + ' · clears ' + drawingResets);
      else if (VARIANT === 'fishing-game') status.setText('Fishing ' + fishingState + ' · caught ' + fishCaught + ' · missed ' + fishMissed + ' · score ' + score);
      else if (VARIANT === 'cooking-game') status.setText('Recipe step ' + recipeStep + '/3 · selected ' + cookingSelection + ' · mistakes ' + cookingMistakes + ' · score ' + dishScore + (outcome === 'complete' ? ' · DISH READY' : ''));
      else status.setText('Target ' + (photoTarget + 1) + ' · photos ' + photosTaken + ' · best ' + bestPhoto);
      if (roleButton) roleButton.setTint(outcome === 'complete' ? 0xffe28a : 0xffffff);
      if (rolePickup && VARIANT === 'cooking-game') rolePickup.setPosition(210 + cookingSelection * 90, 245);
      if (rolePickup && VARIANT === 'fishing-game') rolePickup.setPosition(470, fishingState === 'bite' ? 225 : 255).setAlpha(fishingState === 'bite' || fishingState === 'landed' ? 1 : 0.45);
      hint.setText('PRIMARY / CONFIRM acts · SECONDARY changes/reset · arrows navigate' + (outcome !== 'playing' ? ' · ' + outcome.toUpperCase() : ''));
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT, family: 'party-toy-weird', playerTextureKey: hero.texture.key, backgroundTextureKey: background ? background.texture.key : null,
      cursorTextureKey: cursorSprite.texture.key, cursorRoleSource, panelTextureKey: rolePanel?.texture.key ?? null, panelRoleSource,
      buttonTextureKey: roleButton?.texture.key ?? null, buttonRoleSource, pickupTextureKey: rolePickup?.texture.key ?? null, pickupRoleSource: rolePickupSource,
      platformTextureKey,
      particleTextureKey, particleEffects, drawingVisibleMarks: drawingMarks.length, sandboxVisibleObjects: sandboxMarks.length,
      elapsedMs: Math.round(elapsedMs), score, outcome, lastAction, microgame, microProgress, microSignal, microScores,
      currentPlayer, partyScores, partyTurns, winner, toySpawns, toyResets, toyBodies: toyBodies.map((body) => ({ x: Math.round(body.sprite.x), y: Math.round(body.sprite.y), vx: Math.round(body.vx), vy: Math.round(body.vy) })),
      hunger, happiness, petActions, wardrobeCategory, wardrobe, wardrobeChanges, dressResets, gridCursor, sandboxKind, sandboxSize: sandbox.size, sandboxResets, drawingSize: drawing.size, drawingResets,
      fishingState, fishCaught, fishMissed, recipeStep, cookingSelection, cookingMistakes, dishScore, photoTarget, photosTaken, bestPhoto,
    }));

    let disposed = false; render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return; elapsedMs += deltaMs;
        if (VARIANT === 'microgame-collection') updateMicrogame();
        else if (VARIANT === 'local-party-game') updateParty();
        else if (VARIANT === 'physics-toy') updateToy(deltaMs);
        else if (VARIANT === 'virtual-pet') updatePet(deltaMs);
        else if (VARIANT === 'dress-up-character-toy') updateDress();
        else if (VARIANT === 'sandbox-playground') updateSandbox();
        else if (VARIANT === 'drawing-game') updateDrawing();
        else if (VARIANT === 'fishing-game') updateFishing();
        else if (VARIANT === 'cooking-game') updateCooking();
        else updatePhoto(deltaMs);
        render();
      },
      dispose(): void { if (disposed) return; disposed = true; debugHandle.dispose(); try { background?.destroy(); hero.destroy(); status.destroy(); hint.destroy(); for (const object of objects) object.destroy(); } catch { /* scene teardown */ } },
    };
  },
};
`;
}

export function partyToyStarterKit(variant: PartyToyStarterVariant) {
  const base = defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-party-toy',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Display', x: 480, y: 190, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
  const roles = variant === 'cooking-game' || variant === 'fishing-game'
    ? ['ui.panel', 'ui.button', 'particle'] as const
    : variant === 'drawing-game' || variant === 'dress-up-character-toy'
      ? ['ui.panel', 'ui.button', 'ui.cursor'] as const
      : variant === 'local-party-game'
        ? ['ui.panel', 'ui.button'] as const
        : variant === 'microgame-collection'
          ? ['ui.panel', 'ui.button', 'ui.cursor', 'particle'] as const
          : variant === 'photography-game'
            ? ['ui.cursor', 'ui.panel', 'particle'] as const
            : variant === 'physics-toy' || variant === 'sandbox-playground'
              ? ['ui.cursor', 'particle'] as const
              : variant === 'virtual-pet'
                ? ['ui.panel', 'ui.button'] as const
                : [] as const;
  return withDefaultThemeRoles(base, roles);
}
