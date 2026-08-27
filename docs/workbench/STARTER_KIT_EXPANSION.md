# Starter Kit Expansion Scaffold

This is the control plane for expanding the workbench from five rich proof kits to rich starter kits for the remaining 69 presets. It deliberately does **not** register unfinished kits or upgrade preset maturity. A recipe preset stays `recipe`; a completed high-quality starter becomes `rich-starter-kit`, not `rich-proof-kit`.

## Non-negotiable architecture

- Keep all genre-specific mechanics on normal game surfaces (`content/**`, `themes/**`, `public/**`, `resources/**`, `src/game-specific/**`).
- Do not modify shared runtime/controllers/packs/presets merely to make one starter kit convenient. If a preset has a known missing reusable capability, implement only the bounded game-specific behavior needed for its starter and preserve the limitation.
- Art resolves through semantic roles. No hard-coded workbench asset filenames.
- Use the canonical factory first, then overlay a starter kit. Never create a second generator.
- Register a kit only after its focused tests and real generated-game browser proof pass.
- Do not change preset maturity as a side effect of adding a starter kit. Maturity is evidence; starter depth is product usefulness.

## Sonnet workflow

1. Read `WORKBENCH_OPERATIONAL_STATE.md`, this file, `workbench/server/starterKits/scaffolds.ts`, `authoring.ts`, `expanded/TEMPLATE.ts`, the nearest existing rich kit, and the preset definition.
2. Run `npm run starter-kits:status` and choose the highest-priority unimplemented scaffold in one family. Work in bounded batches; default 3-5 kits per batch.
3. Create `workbench/server/starterKits/expanded/<preset-id>.ts` from `TEMPLATE.ts`. Implement the exact loop and mechanic proofs recorded in the scaffold.
4. Add the completed export to `expanded/index.ts`. Do **not** register partial/stub kits.
5. Add focused unit coverage and a real-browser starter-kit journey that proves the loop in a generated game. Static source assertions are not enough.
6. Run focused tests first, then `npm run workbench:test`, then the relevant browser proof. At family/batch boundaries run `npm run validate` and `npm run qa:workbench`.
7. Keep `knownLimitations` honest. If a bounded starter implements a local workaround, that does not make the missing reusable capability suddenly exist.
8. Stop and report instead of editing shared machine code if a starter cannot be made useful without a genuine architecture decision.

## Promotion gate for every kit

A scaffold may move into the shipped registry only when all are true:

- canonical factory generation succeeds;
- overlay writes only normal game surfaces;
- `player` plus the scaffold's useful semantic roles affect visible gameplay/presentation;
- the stated mechanic proofs are observable in the running generated Phaser game;
- production build succeeds;
- no external requests;
- no console errors;
- source assets remain swappable by role;
- preset maturity and limitations remain truthful;
- test/QA evidence is added before registration.

## Queue

| Priority | Preset | Family | Reference | Target path | Core loop |
|---:|---|---|---|---|---|
| 1 | `bullet-hell` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/bullet-hell.ts` | Survive a short dense but deterministic bullet pattern, damage the source enemy, and clear the encounter. |
| 1 | `metroidvania` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/metroidvania.ts` | Explore a small interconnected level, acquire one traversal ability, backtrack through a previously blocked route, and reach the exit. |
| 1 | `stealth-game` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/stealth-game.ts` | Cross a guarded space, avoid an enemy vision zone, collect an objective, and reach the exit without triggering alarm. |
| 1 | `top-down-racer` | vehicle-movement | `twin-stick-shooter` | `workbench/server/starterKits/expanded/top-down-racer.ts` | Drive a short closed track through ordered checkpoints and finish a timed lap. |
| 1 | `traditional-platformer` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/traditional-platformer.ts` | Reach the exit by running and jumping through a compact obstacle course while collecting optional pickups. |
| 1 | `turn-based-tactics` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/turn-based-tactics.ts` | Move units on a small grid in alternating turns, perform one attack action, and defeat the opposing unit set. |
| 1 | `visual-novel` | narrative-exploration | `idle-incremental` | `workbench/server/starterKits/expanded/visual-novel.ts` | Advance dialogue, make at least one branching choice, and reach one of two explicit endings. |
| 2 | `action-adventure` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/action-adventure.ts` | Move through a top-down encounter, damage an enemy, collect an objective, and open the route to the exit. |
| 2 | `arena-combat` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/arena-combat.ts` | Fight through a compact top-down arena, defeat a fixed enemy set, and end the round when the arena is clear. |
| 2 | `auto-runner` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/auto-runner.ts` | Advance automatically through a short authored course while the player controls jump timing to avoid hazards and finish. |
| 2 | `base-defense` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/base-defense.ts` | Defend a central base through a bounded enemy wave, damage attackers, and resolve survival or base destruction. |
| 2 | `breakout` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/breakout.ts` | Move a paddle, bounce a ball, break a brick set, and complete the round when bricks are gone. |
| 2 | `collectathon-platformer` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/collectathon-platformer.ts` | Explore a platforming space, collect a visible quota of items, and unlock the exit after the quota is met. |
| 2 | `dungeon-crawler` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/dungeon-crawler.ts` | Traverse a small authored dungeon, defeat a guard encounter, collect a key-like objective, and reach the exit. |
| 2 | `endless-runner` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/endless-runner.ts` | Survive an auto-scrolling run by jumping hazards and collecting score pickups until the run ends. |
| 2 | `exploration-game` | narrative-exploration | `twin-stick-shooter` | `workbench/server/starterKits/expanded/exploration-game.ts` | Move through a compact authored space, discover several points of interest, and reach a completion marker after exploring them. |
| 2 | `horizontal-shmup` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/horizontal-shmup.ts` | Fly horizontally through a bounded encounter, shoot enemy targets, dodge hazards, and clear the stage. |
| 2 | `lane-defense` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/lane-defense.ts` | Place or activate defenders in fixed lanes, stop a bounded enemy wave, and complete the round if the endpoint survives. |
| 2 | `maze-game` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/maze-game.ts` | Navigate a grid maze, collect an optional item, and reach the exit without crossing walls. |
| 2 | `museum-exhibit` | narrative-exploration | `twin-stick-shooter` | `workbench/server/starterKits/expanded/museum-exhibit.ts` | Walk through a small exhibit space, inspect several exhibits, and complete the visit after viewing a required set. |
| 2 | `precision-platformer` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/precision-platformer.ts` | Cross a short high-precision platforming gauntlet with tight jumps, hazards, checkpoints, and a finish gate. |
| 2 | `puzzle-platformer` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/puzzle-platformer.ts` | Move through a platforming room where opening the exit requires solving a discrete environmental puzzle. |
| 2 | `reaction-timing` | puzzle-arcade | `idle-incremental` | `workbench/server/starterKits/expanded/reaction-timing.ts` | Wait for a clear go signal, react once, measure response time, and complete a short multi-round result. |
| 2 | `run-and-gun` | shooter | `chase-platformer` | `workbench/server/starterKits/expanded/run-and-gun.ts` | Run and jump through a short side-view combat course, shoot enemies, and reach the exit. |
| 2 | `shopkeeper` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/shopkeeper.ts` | Buy or stock a small inventory, sell to bounded customer events, and grow currency through a short shop cycle. |
| 2 | `time-trial-racer` | vehicle-movement | `twin-stick-shooter` | `workbench/server/starterKits/expanded/time-trial-racer.ts` | Race alone through ordered checkpoints and beat or record a target time. |
| 2 | `top-down-adventure` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/top-down-adventure.ts` | Explore a compact top-down room, collect an objective item, avoid hazards, and reach an exit. |
| 2 | `tycoon-lite` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/tycoon-lite.ts` | Invest currency into two production upgrades, watch income change over time, and reach a target business value. |
| 2 | `vertical-shmup` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/vertical-shmup.ts` | Fly upward through a bounded shooter lane, destroy enemies, dodge fire/hazards, and clear the wave. |
| 3 | `action-roguelite` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/action-roguelite.ts` | Clear a compact combat room, choose one temporary upgrade, and finish a single run with an explicit win/lose reset. |
| 3 | `aquarium-terrarium` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/aquarium-terrarium.ts` | Maintain a small habitat by balancing two resources/needs and keeping its creature state healthy through a short cycle. |
| 3 | `asteroids-shooter` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/asteroids-shooter.ts` | Steer a ship with vehicle-like inertia intent, fire at drifting targets, survive collisions, and clear the field. |
| 3 | `auto-battler` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/auto-battler.ts` | Choose a small squad/setup, start an automated combat round, and resolve a clear win/loss outcome. |
| 3 | `boat-flight-racer` | vehicle-movement | `twin-stick-shooter` | `workbench/server/starterKits/expanded/boat-flight-racer.ts` | Pilot a vehicle through a short gate course with simple altitude/buoyancy-like state and finish after all gates. |
| 3 | `boss-rush` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/boss-rush.ts` | Fight two distinct boss phases or bosses back-to-back with explicit health, telegraphs, and victory state. |
| 3 | `climbing-game` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/climbing-game.ts` | Climb vertically between ledges, recover from falls at checkpoints, and reach a summit marker. |
| 3 | `colony-lite` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/colony-lite.ts` | Assign a few workers to bounded jobs, accumulate resources, and complete one colony construction goal. |
| 3 | `cooking-game` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/cooking-game.ts` | Complete a short ordered recipe by selecting ingredients/actions in sequence and finish with a scored dish result. |
| 3 | `drawing-game` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/drawing-game.ts` | Move a cursor/brush across a bounded canvas grid, leave visible marks, and complete/reset a simple drawing task. |
| 3 | `dress-up-character-toy` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/dress-up-character-toy.ts` | Select wardrobe pieces from a bounded menu, apply them to a character presentation, and save/reset the look in-session. |
| 3 | `endless-driving` | vehicle-movement | `twin-stick-shooter` | `workbench/server/starterKits/expanded/endless-driving.ts` | Drive through a looping authored road while dodging hazards and increasing distance score until a crash ends the run. |
| 3 | `escape-room` | narrative-exploration | `sokoban` | `workbench/server/starterKits/expanded/escape-room.ts` | Inspect a compact room, solve two linked puzzles, and unlock the final exit. |
| 3 | `falling-block-puzzle` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/falling-block-puzzle.ts` | Move and rotate falling blocks on a small board, clear at least one line, and continue until a bounded end state. |
| 3 | `farming-lite` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/farming-lite.ts` | Plant a small set of plots, advance growth through deterministic time/jobs, harvest crops, and reach a harvest target. |
| 3 | `fishing-game` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/fishing-game.ts` | Start a cast, react during a bite/tension sequence, land a fish, and complete a short catch target. |
| 3 | `gallery-shooter` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/gallery-shooter.ts` | Move a visible aim cursor between targets, fire to score hits, and clear a timed target set. |
| 3 | `grappling-platformer` | platforming | `chase-platformer` | `workbench/server/starterKits/expanded/grappling-platformer.ts` | Cross a compact gap course using a bounded grapple mechanic plus normal movement to reach the exit. |
| 3 | `heist-game` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/heist-game.ts` | Enter a guarded room, steal a target item, manage an alarm state, and escape to the exit. |
| 3 | `interactive-fiction-hybrid` | narrative-exploration | `idle-incremental` | `workbench/server/starterKits/expanded/interactive-fiction-hybrid.ts` | Navigate a short text-driven scene with menu verbs/choices, change story state, and reach a branching outcome. |
| 3 | `investigation-game` | narrative-exploration | `twin-stick-shooter` | `workbench/server/starterKits/expanded/investigation-game.ts` | Explore a small scene, collect clues, make one deduction from the evidence set, and unlock the case conclusion. |
| 3 | `kart-racer` | vehicle-movement | `twin-stick-shooter` | `workbench/server/starterKits/expanded/kart-racer.ts` | Complete a short checkpoint race while collecting one bounded pickup that changes vehicle behavior. |
| 3 | `local-party-game` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/local-party-game.ts` | Run a single-device pass-and-play or alternating-turn mini contest with two player slots and a clear winner. |
| 3 | `match-puzzle` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/match-puzzle.ts` | Swap or select adjacent grid cells to create a match, clear pieces, and reach a score/clear target. |
| 3 | `microgame-collection` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/microgame-collection.ts` | Play three very short deterministic microgames in sequence and finish with a combined score/result. |
| 3 | `pet-creature` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/pet-creature.ts` | Care for one creature by managing a few needs/actions until a short wellbeing goal is reached. |
| 3 | `photography-game` | party-toy-weird | `twin-stick-shooter` | `workbench/server/starterKits/expanded/photography-game.ts` | Explore a small scene, frame/select a target with a bounded camera cursor, capture it, and score the photo. |
| 3 | `physics-puzzle` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/physics-puzzle.ts` | Trigger a small physics-like contraption to move an object into a goal using a bounded interaction set. |
| 3 | `physics-toy` | party-toy-weird | `sokoban` | `workbench/server/starterKits/expanded/physics-toy.ts` | Interact with a small sandbox of objects using a bounded push/spawn/trigger control set and observe persistent motion. |
| 3 | `pinball-lite` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/pinball-lite.ts` | Launch a ball into a compact table, bounce from bumpers, score points, and end after a bounded number of drains. |
| 3 | `point-and-click` | narrative-exploration | `idle-incremental` | `workbench/server/starterKits/expanded/point-and-click.ts` | Move a visible cursor between hotspots, inspect/combine a small clue set, and unlock an exit interaction. |
| 3 | `pong` | puzzle-arcade | `sokoban` | `workbench/server/starterKits/expanded/pong.ts` | Move a paddle against a simple opponent, exchange the ball, and score to a short win condition. |
| 3 | `rail-shooter` | shooter | `twin-stick-shooter` | `workbench/server/starterKits/expanded/rail-shooter.ts` | Advance through a scripted sequence of target groups, aim with a bounded cursor, fire, and finish the route. |
| 3 | `restaurant` | simulation-management | `idle-incremental` | `workbench/server/starterKits/expanded/restaurant.ts` | Queue simple orders, process them through timed preparation, serve them, and reach a revenue target. |
| 3 | `rhythm-action` | puzzle-arcade | `idle-incremental` | `workbench/server/starterKits/expanded/rhythm-action.ts` | Respond to a deterministic visual beat lane/timing sequence and finish with a scored accuracy result. |
| 3 | `sandbox-playground` | party-toy-weird | `sokoban` | `workbench/server/starterKits/expanded/sandbox-playground.ts` | Place or toggle a small set of playground objects, interact with them, and reset the scene. |
| 3 | `simple-rts` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/simple-rts.ts` | Select a small unit group, issue bounded movement/attack commands, destroy an objective, and win. |
| 3 | `survivor-like` | top-down-action | `twin-stick-shooter` | `workbench/server/starterKits/expanded/survivor-like.ts` | Survive a short timed arena while enemies spawn in bounded waves, then collect an upgrade and clear the run. |
| 3 | `territory-control` | strategy-defense | `tower-defense` | `workbench/server/starterKits/expanded/territory-control.ts` | Capture and hold a small set of zones while opposing actors contest them, then win by a bounded score/ownership condition. |
| 3 | `virtual-pet` | party-toy-weird | `idle-incremental` | `workbench/server/starterKits/expanded/virtual-pet.ts` | Care for a character through several actions while needs change, then reach a short happy/healthy target. |
