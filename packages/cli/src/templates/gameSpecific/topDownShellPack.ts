import Phaser from 'phaser';
import type { InstalledSystemPack, WorldGraphService } from '@sw2d/contracts';
import { WORLD_GRAPH_CAPABILITY_ID, aimFromPointer } from '@sw2d/contracts';
import {
  bindCollectiblePickups,
  bindStarterEncounters,
  bindStarterBallPaddle,
  bindStarterMelee,
  bindStarterLocalPlay,
  bindStarterStageScroll,
  bindStarterPerception,
  bindStarterNarrative,
  bindStarterProgression,
  bindStarterToy,
  bindStarterWeapon,
  createRoomTransitionRuntime,
  createWorldMapOverlay,
  resolveSceneLevel,
  topDownController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { NARRATIVE_STARTER, PROGRESSION_STARTER, TOY_STARTER } from './packConfig.ts';

/**
 * Generated starter shell: top-down controller family.
 *
 * See platformShellPack.ts's file comment for the pattern this follows -
 * copied verbatim by `sw2d new`, edited freely afterward.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

/**
 * `content/tuning.json`, read for real.
 *
 * Phase 9 / Gate B found that every generated game validated this document and
 * then never read a single value from it - the numbers below were hard-coded
 * in the update loop instead, so editing `content/tuning.json` changed
 * nothing. That made the generated README's "content/tuning.json (tuning
 * values)" claim untrue. The fallbacks are the same numbers the generator
 * writes, so a game with a hand-trimmed tuning document still runs.
 */
interface PlayerTuning {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

function readPlayerTuning(context: SceneContext): PlayerTuning {
  const tuning = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<PlayerTuning> } | undefined;
  return {
    moveSpeed: tuning?.player?.moveSpeed ?? 220,
    jumpVelocity: tuning?.player?.jumpVelocity ?? 430,
    gravity: tuning?.player?.gravity ?? 1100,
  };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    // Procedural generation (capability program Phase 7): when sw2d.generation
    // is installed this is a deterministic seeded NormalizedLevel; otherwise it
    // is the hand-authored content/levels/main.json. Same downstream readers.
    const { level, manifest: generationManifest } = resolveSceneLevel(context, LEVEL_DOCUMENT);
    const playerKey = context.assets.resolve('player');
    const platformKey = context.assets.resolve('platform');
    const { width, height } = context.definition.viewport;

    const walls = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = walls.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    const wallCollider = scene.physics.add.collider(player, walls);

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items - see platformShellPack.ts's note.
    const pickups = bindCollectiblePickups(context, player, level);
    // Encounters (capability program Phase 4): when sw2d.combat + sw2d.weapons
    // + sw2d.encounters are all installed, content/encounters.json drives real
    // enemy waves that chase and shoot; the player fights back with the
    // catalog weapon and respawns on death. Inert otherwise.
    const battle = bindStarterEncounters(context, player);
    // Perception (Category-C Wave 4). Inert unless sw2d.perception is
    // installed with a non-empty catalog. Then FOV cones, cover, loot and
    // exit replace the dummy wander.
    const perception = bindStarterPerception(context);
    if (perception.active) player.setPosition(perception.startX(), perception.startY());
    // Narrative (Category-C Wave 14). Inert unless packConfig names a
    // fiction/case starter and sw2d.narrative is installed. Case mode
    // walks the player to clues; dummy OPTIONS stay on other recipes.
    const story = bindStarterNarrative(context, { mode: NARRATIVE_STARTER });
    if (story.active) {
      player.setPosition(story.startX(), story.startY());
      walls.setVisible(false);
      wallCollider.destroy();
    }
    // Progression (Category-C Wave 17). Inert unless packConfig names a
    // survive/run starter and sw2d.progression is installed. Survive ticks
    // in-run XP while the encounter loop fights; run walks to relics.
    const meta = bindStarterProgression(context, { mode: PROGRESSION_STARTER });
    const runMeta = meta.active && meta.snapshot().mode === 'run';
    if (runMeta) {
      player.setPosition(meta.startX(), meta.startY());
      walls.setVisible(false);
      wallCollider.destroy();
    }
    // Toy (Category-C Wave 20). Inert unless packConfig names a photo/sandbox
    // starter. Photo walks the player to subjects and captures in range;
    // dummy wander fire stays off.
    const toy = bindStarterToy(context, { mode: TOY_STARTER });
    if (toy.active) {
      player.setPosition(toy.startX(), toy.startY());
      walls.setVisible(false);
      wallCollider.destroy();
    }
    // Ball / paddle (Category-C Wave 5). Inert unless sw2d.ball-paddle is
    // installed with a non-empty catalog. Then the table owns motion and
    // the dummy wander is hidden.
    const table = bindStarterBallPaddle(context);
    if (table.active) {
      player.setVisible(false);
      player.setVelocity(0, 0);
      walls.setVisible(false);
    }
    // Melee (Category-C Wave 6). Inert unless sw2d.melee is installed with
    // a non-empty catalog. Then strike / knockback / contact replace dummy
    // wander fire, and encounters stay parked.
    const melee = bindStarterMelee(context);
    if (melee.active) player.setPosition(melee.startX(), melee.startY());
    // Local seats (Category-C Wave 7). Inert unless sw2d.local-play is
    // installed with two seats. Versus pong feeds P2 axis into the table
    // instead of lerp AI. HUD stays on the table.
    const seats = bindStarterLocalPlay(context, { hud: false });
    // Scrolling stage (Category-C Wave 8). Inert unless sw2d.stage-scroll
    // is installed with a positive length. Then the ship stays in a band
    // while the stage streams past; dummy walls hide.
    const stage = bindStarterStageScroll(context);
    if (stage.active) {
      player.setPosition(stage.startX(), stage.startY());
      player.setCollideWorldBounds(false);
      player.setVelocity(0, 0);
      walls.setVisible(false);
      wallCollider.destroy();
    }
    // Weapons (capability program Phase 3). Inert unless sw2d.weapons is
    // installed. When the encounter binding is active it owns the weapon and
    // its projectile runtime, so the plain starter weapon stays inert too.
    const weapon = battle.active ? null : bindStarterWeapon(context);
    // World graph / rooms / transitions / map (capability program Phase 8).
    // Inert unless sw2d.world-graph is installed.
    const worldGraph = context.capabilities.get<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID);
    const mapContainer = scene.game.canvas.parentElement ?? scene.game.canvas;
    const worldMap = worldGraph && mapContainer instanceof HTMLElement ? createWorldMapOverlay(mapContainer, worldGraph) : null;
    const rooms = worldGraph
      ? createRoomTransitionRuntime(context, {
          teardownRoom: () => {
            /* starter graph: nodes share one level, so only the player moves */
          },
          buildRoom: (_level, entrance) => {
            player.setPosition(entrance.x, entrance.y);
            player.setVelocity(0, 0);
            worldMap?.refresh();
          },
        })
      : null;
    let nowMs = 0;
    let facingX = 1;
    let facingY = 0;

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
      weapon: weapon?.snapshot() ?? null,
      ...(battle.active ? { battle: battle.snapshot() } : {}),
      ...(perception.active ? { perception: perception.snapshot() } : {}),
      ...(story.active ? { narrative: story.snapshot() } : {}),
      ...(meta.active ? { progression: meta.snapshot() } : {}),
      ...(toy.active ? { toy: toy.snapshot() } : {}),
      ...(table.active ? { ballPaddle: table.snapshot() } : {}),
      ...(melee.active ? { melee: melee.snapshot() } : {}),
      ...(seats.active ? { localPlay: seats.snapshot() } : {}),
      ...(stage.active ? { stageScroll: stage.snapshot() } : {}),
      ...(generationManifest ? { generation: generationManifest } : {}),
      ...(worldGraph
        ? { worldGraph: { current: worldGraph.currentNode().id, ...worldGraph.mapState(), mapOpen: worldMap?.isOpen ?? false, transitions: rooms?.transitions ?? 0 } }
        : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = topDownController.read(context.input);
        if (table.active) {
          if (seats.active && seats.mode() === 'versus' && table.mode() === 'pong') {
            seats.pump();
            table.setPaddleAxis(seats.axis(0));
            table.setOpponentAxis(seats.axis(1));
          } else {
            const axis = table.mode() === 'pong' ? intent.moveY : intent.moveX;
            table.setPaddleAxis(axis);
          }
          table.tick(deltaMs);
          player.setVelocity(0, 0);
          return;
        }
        player.setVelocityX(intent.moveX * tuning.moveSpeed);
        player.setVelocityY(intent.moveY * tuning.moveSpeed);
        if (melee.active) {
          melee.setPlayer(player.x, player.y);
          if (intent.primaryPressed) melee.strike(nowMs);
          melee.tick(deltaMs, nowMs);
          if (melee.snapshot().outcome !== 'playing') player.setVelocity(0, 0);
          return;
        }
        if (stage.active) {
          stage.setMove(intent.moveX, intent.moveY);
          stage.tick(deltaMs);
          const ship = stage.snapshot();
          player.setPosition(ship.playerX, ship.playerY);
          player.setVelocity(0, 0);
          if (intent.aimMagnitude > 0) {
            facingX = intent.aimX;
            facingY = intent.aimY;
          } else {
            facingX = ship.fireX;
            facingY = ship.fireY;
          }
          weapon?.update(deltaMs, nowMs);
          battle.update(deltaMs, nowMs);
          const firing = intent.primaryPressed || (battle.active && context.input.isDown('PRIMARY_ACTION'));
          if (firing && ship.outcome === 'playing') {
            (weapon ?? battle).fire(nowMs, facingX, facingY, { x: player.x, y: player.y });
          }
          return;
        }
        if (intent.aimMagnitude > 0) {
          // Digital AIM_* stays authoritative (ADR-0016).
          facingX = intent.aimX;
          facingY = intent.aimY;
        } else if (context.spatialPointer.state.inside) {
          // Spatial pointer aim (ADR-0018): with no digital aim held, the
          // mouse/touch position aims - the same optional-fallback contract
          // proofs/twin-stick-shooter proves.
          const aim = aimFromPointer(player.x, player.y, context.spatialPointer.state.worldX, context.spatialPointer.state.worldY);
          if (aim.aimMagnitude > 0) {
            facingX = aim.aimX;
            facingY = aim.aimY;
          }
        } else if (intent.moveMagnitude > 0) {
          facingX = intent.moveX;
          facingY = intent.moveY;
        }
        weapon?.update(deltaMs, nowMs);
        battle.update(deltaMs, nowMs);
        if (perception.active) {
          perception.setPlayer(player.x, player.y);
          perception.tick(deltaMs);
        }
        if (story.active) {
          story.setPlayer(player.x, player.y);
          if (intent.primaryPressed) story.act();
          story.render();
        }
        if (meta.active) {
          meta.setPlayer(player.x, player.y);
          if (intent.primaryPressed && runMeta) meta.act();
          meta.tick(deltaMs);
          meta.render();
        }
        if (toy.active) {
          toy.setPlayer(player.x, player.y);
          if (intent.primaryPressed) toy.act();
          toy.render();
        }
        const firing = intent.primaryPressed || (battle.active && context.input.isDown('PRIMARY_ACTION'));
        if (firing && !perception.active && !story.active && !runMeta && !toy.active) {
          (weapon ?? battle).fire(nowMs, facingX, facingY, { x: player.x, y: player.y });
        }
        if (worldGraph && rooms) {
          rooms.tick();
          if (context.input.consumePress('SECONDARY_ACTION')) worldMap?.toggle();
          if (!rooms.transitioning && !(worldMap?.isOpen ?? false) && player.x > context.definition.viewport.width - 48) {
            const conn = worldGraph.connections().find((c) => worldGraph.canTraverse(c.id).allowed);
            if (conn) rooms.requestTransition(conn.id);
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        battle.dispose();
        weapon?.dispose();
        perception.dispose();
        story.dispose();
        meta.dispose();
        toy.dispose();
        table.dispose();
        melee.dispose();
        seats.dispose();
        stage.dispose();
        rooms?.dispose();
        worldMap?.dispose();
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          walls.clear(true, true);
          walls.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
