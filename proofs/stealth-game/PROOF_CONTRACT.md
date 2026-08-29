# Proof Contract — stealth-game

Frozen before implementation. Phase 11 of the capability-completion program (AI perception, awareness & pursuit).

## Preset

`stealth-game` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.ai`, `sw2d.combat`, `sw2d.world`, `sw2d.ai-perception`, optional `sw2d.navigation`. Content roles `tuning`, `levels`, `perception`.

## Reusable capabilities exercised

- `sw2d.ai-perception` (`PerceptionService`, `PerceptionRuntime`) — vision cone (range 160, FOV 90°), awareness accumulation and decay, occlusion check against wall geometry, noise event generation and hearing detection, target hiding state (`targetVisibility: 'hidden'`).
- `sw2d.ai` (`AiService`) — patrol and chase states.
- `sw2d.navigation` (`NavService`) — walkable grid and path routing.
- `sw2d.world` (`WorldService`) — flags for objective completion.
- `content/perception.json` — data-driven sensor and pursuit definitions.

## Defining journey (automated, deterministic frame stepping)

1. Launch/start: start run (`Space`), enter play scene.
2. Guard patrol: guard patrols horizontally at `y = 200`. Player at `(100, 440)` is outside vision range. Awareness = 0, status is `calm`.
3. Player approaches within FOV: player moves toward guard (`x ≈ 320, y ≈ 200`), entering guard's FOV. Awareness rises; guard enters `suspicious`/`alert`.
4. Player hides behind wall: player steps behind wall obstacle (`x ≈ 260, y ≈ 200`). Line of sight is occluded; awareness decays; last-known position is retained during memory window.
5. Noise distraction: player triggers pebble noise at `(700, 200)` via secondary action (`Shift` / `action2`). Guard hears noise, enters `investigating` status, and turns toward noise.
6. Player enters hiding zone: player moves to shadow hiding spot (`80 <= x <= 160, 260 <= y <= 360`); target visibility becomes `hidden`.
7. Full detection and pursuit: player moves out of hiding directly in front of guard; awareness hits 1.0; guard status becomes `pursuit` (`ai.state === 'chase'`).
8. Escape and decay: player retreats back; guard loses sight; awareness decays back to 0; guard returns to `calm` patrol.
9. Reach exit: player reaches exit at `(900, 440)`; `objectiveReached === true`.
