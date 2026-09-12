import Phaser from 'phaser';
import type { AdvancedPhysicsService, InstalledSystemPack, PuzzleRulesService, WallService, WorldGraphService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID, WALL_CAPABILITY_ID, WORLD_GRAPH_CAPABILITY_ID } from '@sw2d/contracts';
import {
  bindCollectiblePickups,
  bindLevelObjectives,
  bindStarterChase,
  bindStarterEncounters,
  bindStarterParkour,
  bindStarterRun,
  bindStarterWeapon,
  createAdvancedPhysics,
  createRoomTransitionRuntime,
  createWorldMapOverlay,
  platformController,
  resolveSceneLevel,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { CHASE_STARTER, PARKOUR_STARTER, RUN_STARTER } from './packConfig.ts';

/**
 * Generated starter shell: platform controller family.
 *
 * Copied verbatim by `sw2d new` for any preset whose primary controller
 * family is `platform` - this is the "bounded shared template per real
 * controller family" MASTER_PROJECT.md section 8 asks for, the same pattern
 * `starter/src/game-specific/placeholderMoverPack.ts` and `tiledLevelPack.ts`
 * already prove: the runtime is never edited, only this game-specific file
 * reads `platformController` intent and decides how the body moves.
 *
 * Edit this file freely - it lives in `src/game-specific/`, the part of a
 * generated game normal game work touches.
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
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    // Procedural generation (capability program Phase 7): a deterministic
    // seeded NormalizedLevel when sw2d.generation is installed, else the
    // hand-authored content/levels/main.json.
    const { level, manifest: generationManifest } = resolveSceneLevel(context, LEVEL_DOCUMENT);
    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const { width, height } = context.definition.viewport;
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.4;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    const groundCollider = scene.physics.add.collider(player, ground);
    // Auto-run (Category-C Wave 22). Inert unless packConfig names a
    // course/endless starter. Then an authored gap strip replaces dummy
    // walk-and-jump on generated solids.
    const run = bindStarterRun(context, { mode: RUN_STARTER });
    if (run.active) {
      ground.setVisible(false);
      groundCollider.destroy();
      player.setPosition(run.startX(), run.startY());
      run.attach(player);
    }
    // Parkour (Category-C Wave 27). Inert unless packConfig names precision/climb.
    // Player-controlled gaps vs climb; not auto-run (Wave 22).
    const parkour = bindStarterParkour(context, { mode: PARKOUR_STARTER });
    if (parkour.active) {
      ground.setVisible(false);
      groundCollider.destroy();
      player.setPosition(parkour.startX(), parkour.startY());
      parkour.attach(player);
    }
    // Chase (Category-C Wave 31). Inert unless packConfig names pursuit.
    // Player-controlled closing wall; not auto-run, not a chase pack.
    const chase = bindStarterChase(context, { mode: CHASE_STARTER });
    if (chase.active) {
      ground.setVisible(false);
      groundCollider.destroy();
      player.setPosition(chase.startX(), chase.startY());
      chase.attach(player);
    }

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items; then every Collectible whose itemId names a
    // catalog entry grants that item and applies its effects through the
    // reusable service - no per-pickup code here.
    const pickups = bindCollectiblePickups(context, player, level);
    // Level objectives (Category-C convergence): the universal level's
    // Checkpoint / Hazard / Collectible / Exit objects become a real
    // checkpoint-respawn, hazard-reset, collect-then-exit loop through
    // sw2d.world. Only on the plain walk-and-jump path - the auto-run,
    // parkour and chase starters author their own strips, and a world graph
    // owns the right edge as a room transition. Inert without sw2d.world.
    // When sw2d.items owns the collectibles, the exit waits for every pickup.
    const objectives =
      run.active || parkour.active || chase.active || context.capabilities.has(WORLD_GRAPH_CAPABILITY_ID)
        ? bindLevelObjectives(context, player, undefined)
        : bindLevelObjectives(context, player, level, { exitRequires: () => pickups.remaining() === 0 });
    // Encounters (Final Product Completion Wave 3, matrix L16): when sw2d.combat +
    // sw2d.weapons + sw2d.encounters are installed, content/encounters.json
    // drives real waves on the platform strip - `ground` archetypes walk the
    // solids under gravity, shooters hold and fire. Inert otherwise.
    const battle = bindStarterEncounters(context, player, { walls: ground, gravity: tuning.gravity, enemySpeed: 70 });
    // Weapons (capability program Phase 3). Inert unless sw2d.weapons is
    // installed; the battle owns the weapon when it is active.
    const weapon = battle.active ? null : bindStarterWeapon(context);
    // Data-driven puzzle rules (capability program Phase 6). Inert unless
    // sw2d.puzzle-rules is installed; then SECONDARY_ACTION toggles the next
    // switch and CANCEL undoes, all through the reusable service - the
    // switch/goal ruleset and solved-detection are content/puzzles.json, not
    // code here.
    const puzzle = context.capabilities.get<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
    const wallsCap = context.capabilities.get<WallService>(WALL_CAPABILITY_ID);
    // Optional advanced physics (capability program Phase 9). Inert unless
    // content/game.json sets physicsProfile: 'matter'. Then a demo crate rests
    // on a static Matter floor - the reusable Matter-backed service, no raw
    // Matter here. A grappling game replaces this block with a grapple service.
    const advPhysics: AdvancedPhysicsService | null =
      context.definition.physicsProfile === 'matter' ? createAdvancedPhysics(scene) : null;
    const advBody = advPhysics?.enabled
      ? (() => {
          const { width: vw, height: vh } = context.definition.viewport;
          advPhysics.createBody({ id: 'mfloor', x: vw * 0.5, y: vh - 12, shape: { kind: 'rect', width: vw, height: 24 }, static: true, category: 'terrain' });
          return advPhysics.createBody({ id: 'crate', x: vw * 0.5, y: 80, shape: { kind: 'rect', width: 32, height: 32 }, restitution: 0.2, category: 'prop' });
        })()
      : null;
    // World graph / rooms / transitions / map (capability program Phase 8).
    // Inert unless sw2d.world-graph is installed. Then: reaching the right edge
    // takes the first traversable connection from the current node (the bridge
    // tears the room down and rebuilds it at the destination entrance), and
    // SECONDARY_ACTION toggles the map overlay (when no puzzle owns that key).
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
    let facing = 1;

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
      weapon: weapon?.snapshot() ?? null,
      ...(battle.active ? { battle: battle.snapshot() } : {}),
      ...(objectives.active ? { objectives: objectives.snapshot() } : {}),
      ...(puzzle ? { puzzle: puzzle.snapshot(), solved: puzzle.isSolved() } : {}),
      ...(run.active ? { run: run.snapshot() } : {}),
      ...(parkour.active ? { parkour: parkour.snapshot() } : {}),
      ...(chase.active ? { chase: chase.snapshot() } : {}),
      ...(wallsCap?.active()
        ? {
            wall: {
              sliding: wallsCap.sliding(),
              wallId: wallsCap.wallId(),
              state: wallsCap.state(),
              ledgeId: wallsCap.ledgeId(),
              ledges: wallsCap.ledgeStats(),
              lastResult: wallsCap.lastResult(),
              outcome: wallsCap.outcome(),
            },
          }
        : {}),
      ...(generationManifest ? { generation: generationManifest } : {}),
      ...(worldGraph
        ? { worldGraph: { current: worldGraph.currentNode().id, ...worldGraph.mapState(), mapOpen: worldMap?.isOpen ?? false, transitions: rooms?.transitions ?? 0 } }
        : {}),
      ...(advPhysics ? { physics: { enabled: advPhysics.enabled, bodyCount: advPhysics.bodyCount, crate: advBody ? advPhysics.bodyState(advBody) : null } } : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = platformController.read(context.input);
        if (run.active && run.snapshot().outcome !== 'playing') {
          player.setVelocity(0, 0);
        } else if (parkour.active && parkour.snapshot().outcome !== 'playing') {
          player.setVelocity(0, 0);
        } else if (chase.active && chase.snapshot().outcome !== 'playing') {
          player.setVelocity(0, 0);
        } else if (run.active && run.stumbling()) {
          // Tripped on a hazard: the reusable pursuit chaser closes the gap
          // while the runner is held still (Final Product Completion Wave 1).
          player.setVelocityX(0);
        } else if (run.active) {
          player.setVelocityX(260);
          player.setFlipX(false);
          facing = 1;
        } else if (objectives.active && objectives.snapshot().cleared) {
          player.setVelocityX(0);
        } else {
          player.setVelocityX(intent.moveAxis * tuning.moveSpeed);
          if (intent.moveAxis !== 0) {
            player.setFlipX(intent.moveAxis < 0);
            facing = intent.moveAxis < 0 ? -1 : 1;
          }
        }
        weapon?.update(deltaMs, nowMs);
        battle.update(deltaMs, nowMs);
        const firing = intent.primaryPressed || (battle.active && context.input.isDown('PRIMARY_ACTION'));
        if (firing) (weapon ?? battle).fire(nowMs, facing, 0, { x: player.x, y: player.y });
        if (objectives.active) {
          objectives.tick(deltaMs);
          objectives.render();
        }
        if (puzzle) {
          if (context.input.consumePress('SECONDARY_ACTION')) {
            const snap = puzzle.snapshot() as { switches?: readonly string[]; on?: readonly string[] };
            const nextSwitch = (snap.switches ?? []).find((id) => !(snap.on ?? []).includes(id));
            if (nextSwitch !== undefined) puzzle.apply({ kind: 'toggle', id: nextSwitch });
          }
          if (context.input.consumePress('CANCEL')) puzzle.undo();
        }
        if (worldGraph && rooms && !run.active && !parkour.active && !chase.active) {
          rooms.tick();
          if (!puzzle && context.input.consumePress('SECONDARY_ACTION')) worldMap?.toggle();
          if (!rooms.transitioning && !(worldMap?.isOpen ?? false) && player.x > context.definition.viewport.width - 48) {
            const conn = worldGraph.connections().find((c) => worldGraph.canTraverse(c.id).allowed);
            if (conn) rooms.requestTransition(conn.id);
          }
        }
        // Wall / ledge grammar (sw2d.wall): slide, wall-jump, ledge grab,
        // climb-up (UP), drop (DOWN) and hang-jump are one state machine
        // owned by the reusable service; this shell only pins the body
        // while the service says the player is hanging or climbing.
        const wallPlaying = wallsCap?.active() === true && (!parkour.active || parkour.snapshot().outcome === 'playing');
        if (wallsCap && wallPlaying) {
          const pinnedBefore = wallsCap.pinned();
          if (!pinnedBefore) {
            wallsCap.setPlayer(player.x, player.y, player.body.velocity.x, player.body.velocity.y, player.body.blocked.down);
            wallsCap.setHoldX(intent.moveAxis);
          } else {
            if (context.input.consumePress('MOVE_UP')) wallsCap.climb();
            else if (context.input.consumePress('MOVE_DOWN')) wallsCap.drop();
          }
          wallsCap.tick(deltaMs);
          const pinned = wallsCap.pinned();
          if (pinned) {
            // Hanging / climbing: the service owns the position. The Arcade
            // body is switched off so the platform edge cannot push the
            // hanging body around frame to frame.
            player.body.enable = false;
            player.setPosition(pinned.x, pinned.y);
          } else if (!player.body.enable) {
            // Just left a hang/climb: hand the body back to physics at the
            // position the service resolved (the ledge top after a climb,
            // the hang point after a drop / hang-jump).
            player.body.enable = true;
            player.body.reset(wallsCap.x(), wallsCap.y());
            player.body.setAllowGravity(true);
          } else if (wallsCap.sliding()) {
            player.setVelocityY(Math.min(player.body.velocity.y, wallsCap.vy()));
          }
        }
        const wallKick =
          intent.jumpPressed && wallsCap?.active() && wallPlaying && (wallsCap.sliding() || wallsCap.state() === 'ledge-hang')
            ? wallsCap.jump()
            : null;
        if (wallKick) {
          if (!player.body.enable) {
            player.body.enable = true;
            player.body.reset(wallsCap!.x(), wallsCap!.y());
            player.body.setAllowGravity(true);
          }
          player.setVelocity(wallKick.vx, wallKick.vy);
          context.audio.playCue('ui.confirm');
          if (parkour.active) parkour.jumped();
        } else if (
          intent.jumpPressed &&
          player.body.blocked.down &&
          (!run.active || run.snapshot().outcome === 'playing') &&
          (!parkour.active || parkour.snapshot().outcome === 'playing') &&
          (!chase.active || chase.snapshot().outcome === 'playing')
        ) {
          player.setVelocityY(-tuning.jumpVelocity);
          context.audio.playCue('ui.confirm');
          if (run.active) run.jumped();
          if (parkour.active) parkour.jumped();
          if (chase.active) chase.jumped();
        }
        if (run.active) {
          run.setPlayer(player.x, player.y, player.body.blocked.down);
          run.tick(deltaMs);
          run.render();
          if (run.snapshot().outcome !== 'playing') player.setVelocity(0, 0);
        }
        if (parkour.active) {
          parkour.setPlayer(player.x, player.y, player.body.blocked.down);
          parkour.tick(deltaMs);
          parkour.render();
          if (parkour.snapshot().outcome !== 'playing') player.setVelocity(0, 0);
        }
        if (chase.active) {
          chase.setPlayer(player.x, player.y, player.body.blocked.down);
          chase.tick(deltaMs);
          chase.render();
          if (chase.snapshot().outcome !== 'playing') player.setVelocity(0, 0);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        objectives.dispose();
        weapon?.dispose();
        battle.dispose();
        run.dispose();
        parkour.dispose();
        chase.dispose();
        rooms?.dispose();
        worldMap?.dispose();
        advPhysics?.dispose();
        // A restart's batched stop+start can already have torn down this
        // scene's physics world by the time this runs - see
        // placeholderMoverPack.ts's own comment for the full story. Each
        // step is independently guarded for the same reason.
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
