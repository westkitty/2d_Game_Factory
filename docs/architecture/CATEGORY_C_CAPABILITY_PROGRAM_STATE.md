# Category-C Capability Program — durable ledger

Another agent should be able to continue from this file without chat history.

## Starting state

- `origin/main` SHA: `150cdb6698aa44bc14db03165c3dd3a49d6f08b2` (PR #6 merged).
- Implementation branch: `arena/01a086ec-2d-game-factory` (env-pinned successor of `arena/category-c-capability-program`). Work only on this branch. Never commit to `main`. Never merge.
- Seed prompt: `docs/agent-prompts/LM_ARENA_CATEGORY_C_CAPABILITY_PROGRAM.md`.
- Baseline catalog: 23 proof-validated / 3 smoke-validated / 48 recipe (74 total). Unchanged after Wave 1 — generated-game browser journeys passed, but committed `proofs/<id>` + catalog maturity promotion were not done (evidence rule: `proofEvidence.test.ts` requires both).
- Engine, runtime, Workbench host, package boundaries, state ownership, asset/provenance, first-ten capabilities, and PR #6 work are preserved.

## Baseline validation (this environment)

- `npm ci` failed: lockfile does not include `proof-*` workspaces. Use `npm install` and keep the lockfile with the first commit that needs it.
- Unit tests: `npx tsc -p tsconfig.json --noEmit` green; `npx vitest run` **140 files / 2683 tests passed**.
- Browser: no `/usr/bin/google-chrome`. Restored via `@sparticuz/chromium` inflate to `/tmp/chromium` + `/tmp/chrome-wrapper.sh` (`PLAYWRIGHT_CHROME_PATH`). Wrapper sets `LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp` and lambda flags (`--no-sandbox --single-process --no-zygote`). Not committed; next session must re-extract.

## Category-C gap inventory (re-audited from live catalog)

Highest-leverage clusters, from `packages/presets/src/shared.ts` LIMITATIONS + per-recipe strings. The prompt list was a hypothesis; this is the live ranking.

| Rank | Gap | Consumers | Status |
|---|---|---|---|
| 1 | Customer / demand / transaction / production | shopkeeper, restaurant, tycoon-lite | **Wave 1 implemented and played** (`sw2d.economy` / `simulation.economy`, ADR-0028). Residual: layout, walking customers, prestige, offline catch-up. |
| 2 | Creature needs / behavior / relationship | pet-creature, aquarium-terrarium, virtual-pet (colony-lite only if the contract genuinely fits — it currently does not) | **Wave 2 implemented and played** (`sw2d.needs` / `simulation.needs`, ADR-0029). Residual: full creature behaviour AI, relationship graphs, colony assignment. |
| 3 | Branching dialogue / narrative presentation | visual-novel, point-and-click; investigation/museum only if the contract fits | **Wave 3 implemented and played** (`sw2d.dialogue` / `narrative.dialogue`, ADR-0030). Residual: portraits, scene composition, parser IF, evidence-board deduction. |
| 4 | Stealth perception / suspicion / noise / hiding | stealth-game, heist-game | **Wave 4 complete** (`sw2d.perception` / `ai.perception`, ADR-0031). Residual: patrol pathfinding, takedowns, full stealth AI. |
| 5 | Ball / paddle / rebound | breakout, pong | **Wave 5 implemented** (`sw2d.ball-paddle` / `arcade.ball`, ADR-0032). Residual: pinball table. Factory pong versus axes are Wave 7. |
| 6 | Melee / knockback / hit-stun | action-adventure, arena-combat | **Wave 6 implemented** (`sw2d.melee` / `combat.melee`, ADR-0033). Residual: combos, directional attacks, targeting UI. Run-and-gun stays projectile. |
| 7 | Local multiplayer input ownership | local-party-game, pong | **Wave 7 implemented and played** (`sw2d.local-play` / `arcade.seats`, ADR-0034). Residual: netcode, gamepads, split-screen. Overlay pong stays AI. |
| 8 | Scrolling-stage camera | horizontal-shmup, vertical-shmup | **Wave 8 implemented and played** (`sw2d.stage-scroll` / `world.scroll`, ADR-0035). Residual: rail-path cameras, parallax authoring, bullet-hell pooling. Overlay shmups stay the three-enemy lane fight. |
| 9 | Match / falling-block consumption | match-puzzle, falling-block-puzzle | **Wave 9 implemented and played** (existing `sw2d.puzzle-rules` kinds; ADR-0036). Residual: pointer drag-swap, wall-kicks, overlay-local boards. |
| — | Tier 3 leftovers (rail camera, territory, chase, climbing, run-meta, crop/season) | 1 live consumer each | backlog |
| — | Tier 4 specialized (rhythm, parser IF, fishing, cooking, photography, wardrobe, drawing, microgame scheduler, sandbox authoring) | prefer game-specific seam until a second consumer is real | backlog |

Do not extend `sw2d.simulation` / `sw2d.narrative` / `sw2d.ai` into genre monoliths. New narrow packs compose with them.

## Wave 1 — `sw2d.economy`

### Problem

Three management recipes needed stock, a demand queue, settlement and production jobs. Theme, layout and prestige are not shared.

### Consumers

- `shopkeeper` — mode `shop` (serve matching good; K restocks).
- `restaurant` — mode `kitchen` (K cooks; ENTER serves when stocked).
- `tycoon-lite` — mode `factory` (`autoSell` when stocked; K produces).

Materially different: matching-good serve vs cook-then-serve vs produce-and-auto-sell.

### ValidationPlan

1. Contract + schema (`EconomyCatalog` / `economy-catalog`) reject unknown modes and negative stock.
2. Pack unit tests: shop serve / wrong-good / restock / patience leave / demand cycling; kitchen cook-then-serve; factory auto-sell; spawn cap; duplicate ids throw; missing document is inert; dispose withdraws the capability.
3. Generator: all 74 emit schema-valid `content/economy.json`; the three consumers enable `sw2d.economy` and a non-empty catalog; `src/content.ts` actually passes `economy: economyData` into the bundle (this was a Wave-1 bug — import without validate left the pack inert).
4. Generated ui-simulation shell binds `bindStarterEconomy` and skips the dummy picker when active.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/economy/inspect` shows mode/goods/demand.
7. Expanded starter kits for the three consumers drive the same service (`hud: false`) instead of a private auto-sale loop.
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral, simulation-time only.
- [x] Content authority `content/economy.json`.
- [x] ≥2 materially different generated consumers (3 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0028.
- [x] Real-browser play of factory-generated `wave1-shopkeeper` / `wave1-restaurant` / `wave1-tycoon-lite` (`tools/scripts/play-economy-wave1.ts`, 3/3 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those three games (schema + tsc + vite build + boot smoke) PASS.
- [x] `npm run qa:starter-kits:core -- shopkeeper tycoon-lite` PASS.
- [x] `npm run qa:starter-kits:p3j` PASS (farming-lite, pet-creature, colony-lite, restaurant, aquarium-terrarium).
- [ ] Committed `proofs/shopkeeper` + `proofs/restaurant` + `qa:proof` list. **Not done** — would require catalog maturity promotion in the same commit (`proofEvidence.test.ts`).
- [ ] Preset maturity promotion. **Not done — evidence rule.** Recipes stay `recipe`.

### Implementation notes

- Capability id `simulation.economy` (family `simulation`, service `economy`). Pack id `sw2d.economy`.
- Duplicate good/recipe ids throw at install. Unknown demand goodIds are skipped at spawn (no crash).
- `bindStarterEconomy` is INERT when the capability is missing. `{ hud: false }` lets expanded kits keep their own presentation.
- Idle-incremental's committed proof keeps its own shell and does **not** consume economy.
- Restaurant starter overlay must pass secondary + nav into `updateRestaurant` (Wave-1 bug: cook/recipe select were dropped, so K did nothing).
- Overlay unused `customerMs` / `nextOrderId` fail generated-game `tsc` (`noUnusedLocals`).
- Impatient-customer pack test must not also fire spawn in the same `dt` (use a long `intervalMs` + `maxQueue: 1`).

### Browser journeys (executed)

Factory-generated (ui-simulation shell HUD):

- Shopkeeper: Pat wants apple → spam ENTER serves once then `no-customer` → restock bread → restock spam hits `cannot-afford` (cash $1, bread x6) → pause/resume preserves served=2.
- Restaurant: ENTER with empty queue → `no-customer`; cook soup → serve ($12); cook salad → serve ($21); cook soup → serve ($33). 3 served.
- Tycoon-lite: buyer in queue → K starts `make-widget` → auto-sell cash 8→14 served 1; second produce auto-sells cash 20 served 2.

Starter-kit overlays (`game.expanded-starter`): shopkeeper / tycoon-lite / restaurant mechanic proofs PASS. Farming/pet/colony/aquarium still pass (economy binding is inert there).

### Visual inspection

High-contrast Phaser HUD (mode, cash, stock, front customer, selection, last result, control hint). Dummy picker hidden when economy is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `content.ts.template` dropped `economy` at validate (pack saw empty catalog).
- Impatient unit test raced spawn.
- Restaurant catalog limitation row lagged shopkeeper/tycoon-lite (`docsSync`).
- `bindStarterEconomy` dispose crashed typecheck when `hud: false` (null HUD).
- Restaurant kit `updateRestaurant(...)` omitted secondary/nav (could not cook or pick recipes).
- Overlay leftover unused locals broke kit `tsc`.
- p3j `restaurantRun` still queued via KeyJ/local `orders`; rewritten to cook-matching-ticket on `sw2d.economy`.

### Remaining blockers / unknowns

- No committed `proofs/` for the three consumers; catalog maturity stays `recipe`.
- Chrome wrapper is session-local under `/tmp`.
- `package-lock.json` may be dirty from `npm install` (proof workspaces). Include with the Wave-1 commit if node_modules/proofs require it.
- Next wave: **done** — Wave 2 creature needs (see below).

## Wave 2 — `sw2d.needs`

### Problem

Three care recipes needed decaying meters, care actions, affinity and wellbeing hold/fail. Theme, creature AI, relationship graphs and colony assignment are not shared.

### Consumers

- `pet-creature` — mode `creature` (J feeds hunger, K plays mood; hold 1600 ms after both ≥ 82).
- `aquarium-terrarium` — mode `habitat` (J feeds food, K refreshes water; hold 7000 ms after both ≥ 55; fail if any meter ≤ 10).
- `virtual-pet` — mode `companion` (J feeds hunger, K plays happiness; complete when both ≥ 85 after two acts).

Materially different: companion complete-on-threshold vs creature hold-then-complete vs habitat long hold with fail floor.

`colony-lite` was **not** wired — assignment/roles are a different contract.

### ValidationPlan

1. Contract + schema (`NeedsCatalog` / `needs-catalog`) reject unknown modes, duplicate meter/action ids, missing `targetMeter` / `delta`, empty meters, `failBelow` ≥ `completeAt`.
2. Pack unit tests: decay, act + cooldown + affinity, clamp, fail-below, hold-then-complete, pause (dt=0), restart, missing document is inert, dispose withdraws the capability, malformed catalog throws.
3. Generator: all 74 emit schema-valid `content/needs.json`; the three consumers enable `sw2d.needs` and a non-empty catalog; `src/content.ts` passes `needs: needsData` into the bundle.
4. Generated ui-simulation shell binds `bindStarterNeeds` after economy; dummy picker hidden when needs is active. J/K map to `actByIndex(0/1)`; confirm `act()`.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/needs/inspect` shows mode/meters/actions.
7. Expanded starter kits for the three consumers drive the same service (`hud: false`) instead of private decay loops.
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral, simulation-time only.
- [x] Content authority `content/needs.json`.
- [x] ≥2 materially different generated consumers (3 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0029.
- [x] Real-browser play of factory-generated `wave2-pet-creature` / `wave2-aquarium-terrarium` / `wave2-virtual-pet` (`tools/scripts/play-needs-wave2.ts`, 3/3 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those three games (schema + tsc + vite build + boot smoke) PASS.
- [x] `npm run qa:starter-kits:p3j` PASS (farming-lite, pet-creature, colony-lite, restaurant, aquarium-terrarium).
- [x] `npm run qa:starter-kits:p3h` PASS (microgame-collection, physics-toy, sandbox-playground, virtual-pet, photography-game).
- [ ] Committed `proofs/pet-creature` + `proofs/aquarium-terrarium` + `proofs/virtual-pet` + `qa:proof` list. **Not done** — would require catalog maturity promotion in the same commit (`proofEvidence.test.ts`).
- [ ] Preset maturity promotion. **Not done — evidence rule.** Recipes stay `recipe`.

### Implementation notes

- Capability id `simulation.needs` (family `simulation`, service `needs`). Pack id `sw2d.needs`.
- Duplicate meter/action ids throw at install. Unknown `targetMeter` throws. Missing `content/needs.json` is inert.
- `bindStarterNeeds` is INERT when the capability is missing. `{ hud: false }` lets expanded kits keep their own presentation.
- Shell priority: economy.active first, then needs.active, then dummy picker. No consumer currently installs both.
- Overlay rates frozen from the previous private loops (do not invent): pet −0.0028/−0.0022 +22/+24 complete all≥82 hold 1600 +2 acts fail 0; aquarium water −0.003 food −0.0035 +24/+24 complete ≥55 hold 7000 +2 acts fail 10; virtual-pet −0.003/−0.0025 +25/+25 complete both≥85 +2 acts holdMs 0 no fail.
- Live limitation: “Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not.”
- `POST /api/needs/inspect` must be a real route (import-only fails `noUnusedLocals`).
- `needsPack` must be in `REAL_PACKS` in `catalogPackIntegrity.test.ts`.

### Browser journeys (executed)

Factory-generated (ui-simulation shell HUD):

- Pet-creature: hunger/mood ~71 → decay hunger 70.1 → J feed 91.8 actions=1 → spam feed clamps 99.86 → K play mood 92.3 actions=14 hold 83.3 → complete outcome=complete hold 1600 affinity=14; pause/resume preserves complete.
- Aquarium-terrarium: water/food ~77 → J feed food 99.7 → K refresh water 99.75 actions=2 → complete hold 7006.9.
- Virtual-pet: hunger/happiness ~69 → J feed 94.17 outcome=playing → K play 94.27 actions=2 outcome=complete.

Starter-kit overlays (`game.expanded-starter`): pet-creature / aquarium-terrarium / virtual-pet mechanic proofs PASS. Farming/colony/restaurant/microgame/physics-toy/sandbox/photography still pass (needs binding is inert there except the three consumers).

### Visual inspection

High-contrast Phaser HUD (mode, meters, selection, last result, control hint `J FEEDS  -  K PLAYS OR REFRESHES  -  KEEP NEEDS UP`). Dummy picker hidden when needs is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `POST /api/needs/inspect` was import-only until route added after economy inspect (`noUnusedLocals`).
- `needsPack` imported in catalogPackIntegrity without `REAL_PACKS` (`noUnusedLocals` + “every referenced pack id is real”).
- Honesty/MATRIX `virtual-pet` row must list `needs` (StrReplace can miss; verify file).
- Overlay unused locals / leftover private decay must not break generated-game `tsc`.

### Remaining blockers / unknowns

- No committed `proofs/` for the three consumers; catalog maturity stays `recipe`.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Next wave: **in progress** — Wave 3 branching dialogue (see below).

## Wave 3 — `sw2d.dialogue`

### Problem

Visual-novel and point-and-click needed authored branching graphs, choices, flags and endings. Portraits, parser IF and evidence boards are not shared.

### Consumers

- `visual-novel` — mode `novel` (auto-start; ENTER advances; arrows choose; two endings).
- `point-and-click` — mode `adventure` (idle until hotspot `start`; inspect sets flags; gated door completes).

Materially different: auto-start keyboard novel vs hotspot-started gated adventure.

`investigation-game` / `museum-exhibit` / `interactive-fiction-hybrid` were **not** wired — deduction, exhibits and parser IF are different contracts. Committed `proofs/point-and-click` is a frozen custom lever/key shell and is not regenerated from the template.

### ValidationPlan

1. Contract + schema (`DialogueCatalog` / `dialogue-catalog`) reject unknown modes.
2. Pack unit tests: novel two-ending branch; adventure inspect flags + locked door; duplicate ids throw; unknown next throws; missing document is inert; dispose withdraws the capability; reset restores the start node.
3. Generator: all 74 emit schema-valid `content/dialogue.json`; the two consumers enable `sw2d.dialogue` and a non-empty catalog; `src/content.ts` passes `dialogue: dialogueData`.
4. Generated ui-simulation shell binds `bindStarterDialogue` after economy/needs. Generated pointer shell replaces the dummy target with hotspots when adventure is active.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/dialogue/inspect` shows mode/conversations/hotspots.
7. Expanded visual-novel kit drives the same service (`hud: false`) while keeping overlay debug fields (`dialogueStep` / `branch` / `ending`).
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/dialogue.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0030.
- [x] Real-browser play of factory-generated `wave3-visual-novel` / `wave3-point-and-click` (`tools/scripts/play-dialogue-wave3.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS.
- [x] `npm run qa:starter-kits:core -- visual-novel` PASS.
- [x] `npm run qa:starter-kits:p3k` PASS (escape-room, IF-hybrid, investigation, point-and-click overlay still uses the cursor-clue loop).
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `narrative.dialogue`. Pack id `sw2d.dialogue`. Not folded into `sw2d.narrative`.
- Shell priority: economy.active, then needs.active, then dialogue.active, then dummy picker / dummy pointer target.
- Novel catalog: two lines, one choice, end-nodes carry `ending` so the overlay's 4-confirm journey matches.
- Adventure catalog: note/clock inspect `end` nodes set flags without completing; door requires both flags and its `ending` completes.
- `POST /api/dialogue/inspect` must be a real route. `dialoguePack` must be in `REAL_PACKS`.
- Overlay `visualNovel` maps `step`/`selectedIndex`/`branch`/`ending` onto the existing debug fields the core kit QA reads. ArrowLeft/Right use absolute 0/1, not wrap, so ArrowLeft on index 0 stays help.

### Browser journeys (executed)

Factory-generated:

- Visual-novel: Space×2 → choice step=2; ArrowRight selectedIndex=1; Space branch=`keep-the-secret`; Space ending=`midnight-ending` outcome=complete; pause/restart; Space×2 + ArrowLeft + Space×2 ending=`dawn-ending`.
- Point-and-click: idle adventure; click locked door → lastResult=`locked`; click note + Space sets `saw-note` and returns idle; clock sets `saw-clock`; door unlocks; click door + Space ending=`escaped` outcome=complete.

Starter-kit overlays: visual-novel mechanic proof PASS (same 4-confirm journey, debug fields `dialogueStep`/`branch`/`ending`). P3-K overlays still pass; P&C overlay is still the cursor-clue loop, not `sw2d.dialogue`.

### Visual inspection

High-contrast Phaser HUD (mode, speaker, line/choices, last result, `ENTER ADVANCES` / `CLICK A HOTSPOT`). Dummy picker / dummy pointer target hidden when dialogue is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `src/main.ts.template` imported `dialoguePack` but did not put it in `createGame({ packs })` — the capability never installed.
- `dialoguePack` imported in catalogPackIntegrity without `REAL_PACKS`.
- `exactOptionalPropertyTypes` rejected `conversationId: string | undefined` on act results.
- Factory ArrowLeft used wrap `select(-1)`; overlay QA requires absolute index 0. Factory shell now matches (ArrowLeft on 0 stays help).
- Novel graph originally had extra n5/n6 line nodes after the choice; overlay's 4-confirm journey needs the choice to land on an `end` node so one more confirm completes.

### Remaining blockers / unknowns

- No committed `proofs/` for visual-novel; point-and-click proof stays the frozen Phase-1 lever/key game.
- Catalog maturity unchanged (`visual-novel` smoke-validated, `point-and-click` proof-validated on the frozen proof).
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Next wave: **done** — Wave 4 stealth perception (see below).

## Wave 4 — `sw2d.perception`

### Problem

Stealth-game and heist-game needed real FOV cones, occlusion, suspicion, noise and hiding. Patrol pathfinding and takedowns are not shared.

### Consumers

- `stealth-game` — mode `infiltrate` (uncovered cone sight fails; northern bypass loots and escapes).
- `heist-game` — mode `heist` (loot sets alarm without failing; exit still requires the objective).

Materially different: fail-on-sight vs loot-alarm escape.

### ValidationPlan

1. Contract + schema (`PerceptionCatalog` / `perception-catalog`) reject unknown modes.
2. Pack unit tests: corridor fail, northern bypass, cover, heist loot-alarm, occlusion AABB, duplicate ids, missing document inert, dispose, reset, noise.
3. Generator: all 74 emit schema-valid `content/perception.json`; the two consumers enable `sw2d.perception` and a non-empty catalog; `src/content.ts` passes `perception: perceptionData`; `main.ts` installs `perceptionPack`.
4. Generated top-down shell binds `bindStarterPerception` and feeds `setPlayer`/`tick`.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/perception/inspect`.
7. Expanded stealth/heist kits drive the same service (`hud: false`) while keeping overlay debug fields (`alarm` / `guardSeesPlayer` / `objectiveCollected`).
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/perception.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0031.
- [x] Real-browser play of factory-generated `wave4-stealth-game` / `wave4-heist-game` (`tools/scripts/play-perception-wave4.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] Overlay QA (`qa-expanded-starter-kits.ts stealth-game` PASS; `qa-expanded-starter-kits-p3c.ts heist-game` PASS).
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Bugs found and fixed during Wave 4 play

- Generated `src/main.ts` listed `perceptionPack` in the `packs` array but did not import it (`perceptionPack is not defined` at boot). The template import list now includes `perceptionPack`.
- Overlay stealth/heist rectangle `updateGuard` and INTERACT collect would have raced the reusable service; both skip while `perception.active`.

## Wave 5 — `sw2d.ball-paddle`

### Problem

Breakout and pong needed serve, paddle rebound, wall bounce, brick-clear / first-to-N and miss/reset. Pinball tables and local multiplayer input routing are not shared.

### Consumers

- `breakout` — mode `breakout` (2×6 bricks, three lives, paddle-return, clear-or-drain).
- `pong` — mode `pong` (player paddle, lerp opponent, first to 3).

Materially different: brick-clear + lives vs two-paddle score-to-N. Pinball-lite stays Matter. Pong multiplayer stays a limitation.

### ValidationPlan

1. Contract + schema (`BallPaddleCatalog` / `ball-paddle-catalog`) reject unknown modes.
2. Pack unit tests: paddle return, brick break, drain/serve, last-life fail, clear complete, pong player/opponent return, score/win, lerp, clamp, duplicate ids, missing document inert, dispose, reset.
3. Generator: all 74 emit schema-valid `content/ball-paddle.json`; the two consumers enable `sw2d.ball-paddle` and a non-empty catalog; `src/content.ts` passes `'ball-paddle': ballPaddleData`; `main.ts` installs `ballPaddlePack`.
4. Generated top-down shell binds `bindStarterBallPaddle` and feeds `setPaddleAxis`/`tick`.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/ball-paddle/inspect`.
7. Expanded breakout/pong kits drive the same service (`hud: false`) while keeping overlay debug fields.
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/ball-paddle.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0032.
- [x] Real-browser play of factory-generated `wave5-breakout` / `wave5-pong` (`tools/scripts/play-ball-paddle-wave5.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] Overlay QA (`qa-expanded-starter-kits-p2b.ts breakout` PASS; `qa-expanded-starter-kits-p3e.ts` 3/3 PASS including pong).
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `arcade.ball`. Pack id `sw2d.ball-paddle`. Not folded into `sw2d.arcade`.
- Overlay-matching constants live in generated `content/ball-paddle.json`.
- Opponent AI is the machine; local multiplayer is not.
- Empty catalog (no bricks, no pong table) is inert.
- Overlay breakout syncs brick sprites by catalog index against `table.bricks()[i].alive`. Overlay pong drives `setPaddleAxis` / `tick` / `snapshot`. Pinball-lite stays Matter.

### Browser journeys (executed)

Factory-generated (top-down shell HUD):

- Breakout: 12 bricks, 3 lives → paddle-track 9 returns → bricks 0, score 120, lives 3, outcome=complete.
- Pong: first-to-3; player-return (vx 210→226, ballX increases); dodge until opponentScore=3, playerScore=0, outcome=failed.

Starter-kit overlays (`game.expanded-starter`): breakout mechanic proof PASS; pong mechanic proof PASS. Match-puzzle / falling-block-puzzle still pass (binding is inert there).

### Visual inspection

High-contrast Phaser HUD (BREAKOUT / PONG title, score/bricks/lives or you/opp, `MOVE WASD/ARROWS   RETURN THE BALL`). Dummy wander hidden when the table is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Generated `src/main.ts` imported `ballPaddlePack` but did not put it in `createGame({ packs })` — same class of miss as Wave 4's `perceptionPack`. The template packs array now includes `ballPaddlePack`. The generate test asserts `perceptionPack, ballPaddlePack, GAME_SPECIFIC_PACK`.
- `SCHEMA_DOCUMENTS` listed `'ball-paddle-catalog'` in `SCHEMA_NAMES` / Ajv registration but omitted the document map entry (tsc).
- `catalogPackIntegrity` imported `ballPaddlePack` without `REAL_PACKS` (`noUnusedLocals`).
- Brick `alive` is readonly on the contracts type; the service now mutates a private `LiveBrick`.
- Overlay pong dispose omitted `table.dispose()`.
- P2-B / P3-E CDP scripts hang after success unless they `process.exit`. Both now do. P3-E accepts an argv filter so `pong` can run alone.

### Remaining blockers / unknowns

- No committed `proofs/` for breakout or pong; catalog maturity stays `recipe`.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Next wave: melee / knockback / hit-stun (action-adventure, arena-combat) — re-audit before sharing.

## Wave 6 — `sw2d.melee`

### Problem

Action-adventure and arena-combat needed strike windows, nearest-foe hit, knockback, hit-stun and contact damage. Combos, directional attacks and targeting UI are not shared. Run-and-gun stays a frozen projectile proof.

### Consumers

- `action-adventure` — mode `skirmish` (one elite HP 3, overlay then loots/exits).
- `arena-combat` — mode `arena` (three fodder HP 2, clear-to-win).

Materially different: 1×3 skirmish + objective overlay vs 3×2 arena clear. Damage goes through `combat.health`.

### ValidationPlan

1. Contract + schema (`MeleeCatalog` / `melee-catalog`) reject unknown modes.
2. Pack unit tests: in-range hit + knockback + stun, three-hit clear, miss, cooldown, arena 3×2, contact cadence, last-hit fail, duplicate ids, missing document inert, dispose, reset.
3. Generator: all 74 emit schema-valid `content/melee.json`; the two consumers enable `sw2d.melee` and a non-empty catalog; `src/content.ts` passes `melee: meleeData`; `main.ts` installs `meleePack`.
4. Generated top-down shell binds `bindStarterMelee` and feeds `setPlayer`/`strike`/`tick`.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/melee/inspect`.
7. Expanded action-adventure / arena-combat kits drive the same service (`hud: false`) while keeping overlay debug fields (`lastAction === 'attack'`).
8. Real-browser journeys against generated games + starter-kit overlays. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral, composes with `combat.health`.
- [x] Content authority `content/melee.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0033.
- [x] Real-browser play of factory-generated `wave6-action-adventure` / `wave6-arena-combat` (`tools/scripts/play-melee-wave6.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] Overlay QA (`qa-expanded-starter-kits-p2b.ts action-adventure arena-combat` 2/2 PASS).
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `combat.melee`. Pack id `sw2d.melee`. Depends on `combat.health`. Not folded into `sw2d.combat`.
- Overlay-matching constants live in generated `content/melee.json`. Strike cooldown **0**. Knockback 8 / stun 80 ms so three skirmish hits stay inside range 145.
- Overlay maps strike `hit` → debug `lastAction = 'attack'` so P2-B stays stable. Overlay adventure keeps local objective/exit; overlay arena wins on `snap.outcome === 'complete'`.
- Factory parks weapons/encounters while `melee.active` (walk + strike remain). Overlay skips local `attack()` / `contactDamage()` while melee is active.
- Empty foe list is inert. Duplicate foe ids throw.

### Browser journeys (executed)

Factory-generated (top-down shell HUD):

- Action-adventure skirmish: 1 foe HP 3 → approach x≈355 → three strikes, foesAlive 0, lastResult=hit, outcome=complete, playerHealth 5.
- Arena-combat: 3 foes HP 2 → north-east first kill (2 alive) → mid kill (1 alive) → third in range, foesAlive 0, outcome=complete, playerHealth 5.

Starter-kit overlays (`game.expanded-starter`): action-adventure (clear + loot + exit victory) PASS; arena-combat (three fodder, victory) PASS.

### Visual inspection

High-contrast Phaser HUD (`SKIRMISH` / `ARENA`, hp / foes / last strike, `MOVE WASD/ARROWS   STRIKE J/X`). Dummy wander fire hidden when melee is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Knockback originally wrote velocity only, so a strike did not move the foe until `tick` (unit test `x > 470` failed). Hit now also displaces immediately.
- Knockback 12 pushed the elite out of range 145 on the third tap. Catalog knockback is 8.
- Overlay still ran local `contactDamage()` after syncing HP from the pack (double-count). Skipped while `melee.active`.
- Factory shell omitted `melee.dispose()`.
- Unused `this.nowMs` failed `tsc` (`noUnusedLocals`).

### Remaining blockers / unknowns

- No committed `proofs/` for action-adventure or arena-combat; catalog maturity stays `recipe`.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Next wave: **done** — Wave 7 local multiplayer input ownership (see below).

## Wave 7 — `sw2d.local-play`

### Problem

Local-party-game needed pass-and-play turns and scores on one keyboard.
Pong needed a second human axis without rewriting ActionInputHost (WASD
and arrows already share `MOVE_*`). Netcode, gamepads and split-screen
are not shared. Overlay pong keeps Wave 5 lerp AI.

### Consumers

- `local-party-game` — mode `hotseat` (six acts, `pointsCycle` `[1,2,3]`, tie awards seat 0).
- `pong` — mode `versus` (P1 arrows / P2 WASD; factory feeds `setOpponentAxis`).

Materially different: sequential hot-seat scoring vs simultaneous disjoint axes composed with `sw2d.ball-paddle`. Overlay pong was **not** wired (AI + `forceOpponentWin` stay).

### ValidationPlan

1. Contract + schema (`LocalPlayCatalog` / `local-play-catalog`) reject unknown modes.
2. Pack unit tests: six-act 6–6 tie, seventh ignored, versus disjoint axes, versus `act()` no-op, duplicate ids, missing document inert, `<2` players inert, dispose, reset.
3. Generator: all 74 emit schema-valid `content/local-play.json`; the two consumers enable `sw2d.local-play` and a non-empty catalog; `src/content.ts` passes `'local-play': localPlayData`; `main.ts` installs `localPlayPack`.
4. Generated ui-simulation shell binds `bindStarterLocalPlay` and acts on J/ENTER. Generated top-down shell pumps versus seats into `setOpponentAxis`.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/local-play/inspect`. Inspector also disposes melee (pre-existing miss).
7. Expanded local-party-game kit drives the same service (`hud: false`) while keeping overlay debug fields.
8. Real-browser journeys against factory-generated games. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/local-play.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0034.
- [x] Real-browser play of factory-generated `wave7-local-party-game` / `wave7-pong` (`tools/scripts/play-local-play-wave7.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS (CDP hang after printed success, as before).
- [ ] Overlay P3-G re-run. **Not done this wave** — overlay party is wired; p3g still uses `process.exitCode` and validate-hangs.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `arcade.seats`. Pack id `sw2d.local-play`. Not folded into `sw2d.arcade`.
- Pack has no window listeners; `bindStarterLocalPlay` pumps `KeyboardEvent.code` into `setHeld`. Tests inject codes.
- Versus does not remap ActionInputHost. Factory pong never shares `intent.moveY` when seats are active.
- `setOpponentAxis(null)` restores lerp AI (Wave 5 overlay).
- Empty / `<2` players is inert. Duplicate player ids throw.

### Browser journeys (executed)

Factory-generated:

- Local-party-game: hotseat turns 0 → 6× KeyJ → scores 6–6, winner 0, outcome=complete.
- Pong: versus; ArrowDown axis0=1 paddleY 270→357; KeyW axis1=-1 opponentY 270→183. Axes stay disjoint.

### Visual inspection

High-contrast Phaser HUD (`PLAYER N` / `VERSUS`, scores or axes, `J/ENTER ACTS` / `P1 ARROWS P2 WASD`). Dummy picker hidden when seats are active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Generated `src/main.ts` imported `localPlayPack` but the packs array omit was the same class of miss as Waves 4–5. Template now includes `localPlayPack`; generate tests assert the full tail.
- `SCHEMA_DOCUMENTS` listed `local-play-catalog` in `SCHEMA_NAMES` but the Ajv addSchema loop omitted it (would throw at load).
- Inspector melee dispose was missing on teardown (pre-existing); local-play host + both disposes added.
- `bindStarterBallPaddle` advertised `setOpponentAxis` on the type before the live return object implemented it.

### Remaining blockers / unknowns

- No committed `proofs/` for local-party-game or pong; catalog maturity stays `recipe`.
- Overlay pong stays AI. Netcode / gamepads / split-screen stay out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: combos, pinball, Tier 3/4, committed proofs.
- Next wave: **done** — Wave 8 scrolling-stage camera (see below).

## Wave 8 — `sw2d.stage-scroll`

### Problem

Horizontal-shmup and vertical-shmup needed terrain streaming past a ship
held in a screen-space band, plus stage-clear. The generated starter
fought encounter waves in a fixed arena. Rail-path cameras, parallax
authoring and bullet-hell pooling are not shared. Overlay shmups keep
the three-enemy lane fight so P2-C stays valid.

### Consumers

- `horizontal-shmup` — mode `horizontal` (stream left, fire +X, band x 40–420).
- `vertical-shmup` — mode `vertical` (stream down, fire −Y, band y 260–510).

Materially different: incoming-right vs incoming-top, plus opposite default fire dirs.

### ValidationPlan

1. Contract + schema (`StageScrollCatalog` / `stage-scroll-catalog`) reject unknown modes.
2. Pack unit tests: offset/complete, band clamp, incoming-edge placement, vertical stream, contact, duplicate ids, missing document inert, dispose, reset, dt=0.
3. Generator: all 74 emit schema-valid `content/stage-scroll.json`; the two consumers enable `sw2d.stage-scroll` and a non-empty catalog; `src/content.ts` passes `'stage-scroll': stageScrollData`; `main.ts` installs `stageScrollPack`.
4. Generated top-down shell binds `bindStarterStageScroll`, parks dummy walls, drives the ship, keeps `bindStarterEncounters` for shooting.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/stage-scroll/inspect`.
7. Overlay shmups **not** bound (P2-C three-enemy lane fight).
8. Real-browser journeys against factory-generated games. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/stage-scroll.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0035.
- [x] Real-browser play of factory-generated `wave8-horizontal-shmup` / `wave8-vertical-shmup` (`tools/scripts/play-stage-scroll-wave8.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P2-C re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `world.scroll`. Pack id `sw2d.stage-scroll`. Not folded into `sw2d.world`.
- Empty catalog (length or speed not positive) is inert. Duplicate hazard ids throw.
- Horizontal: `screenX = viewport.width - (offset - along)`. Vertical: `screenY = offset - along`.
- Factory HUD stays on. Overlay shmups do not bind.
- `LIMITATIONS.scrollingShmupCamera` names what is reusable and what is not.
- Generated `src/main.ts` must both import and install `stageScrollPack` (same miss class as Waves 4–7).
- Band-clamp unit test must not complete the stage on the first 5s tick (`length: 99_999`).
- Dummy wall collider is destroyed when the stage is active so the ship is not shoved by the proof-level ground strip.

### Browser journeys (executed)

Factory-generated (top-down shell HUD):

- Horizontal-shmup: mode horizontal, fire +X; ArrowDown playerY 270→340; KeyJ projectilesSpawned 1; offset 720 progress 1 outcome=complete; hazardsVisible 3.
- Vertical-shmup: mode vertical, fire −Y; ArrowRight playerX 480→550; KeyJ projectilesSpawned 1; offset 720 progress 1 outcome=complete; hazardsVisible 3.

### Visual inspection

High-contrast Phaser HUD (`HORIZONTAL` / `VERTICAL`, stage %, `MOVE WASD/ARROWS   FIRE J/X   CLEAR THE STAGE`). Dummy walls hidden; ship stays in the authored band while tiles/hazards stream. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Generated `src/main.ts` imported `stageScrollPack` but omitted it from `createGame({ packs })`.
- Debug snapshot omitted `stageScroll` (play script would have seen undefined).
- Band-clamp test completed the stage on the first 5s tick, so the opposite-direction clamp never ran.
- Dummy wall collider stayed live after `setVisible(false)` and could shove the ship.

### Remaining blockers / unknowns

- No committed `proofs/` for the two shmups; catalog maturity stays `recipe`.
- Overlay shmups stay the local three-enemy lane fight.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: combos, pinball, rail cameras, Tier 3/4, committed proofs.
- Next wave: **done** — Wave 9 match / falling-block consumption (see below).

## Wave 9 — consume `sw2d.puzzle-rules` match and falling-block

### Problem

`match-puzzle` and `falling-block-puzzle` still used the code-configured
`sw2d.puzzle` seam. Phase 6 already shipped both engines inside
`sw2d.puzzle-rules`. The leftover was consumption, not a missing pack.

### Consumers

- `match-puzzle` — kind `match` (cursor select, adjacent swap, cascade, clear objective).
- `falling-block-puzzle` — kind `falling-block` (move, rotate, gravity tick, hard-drop, line-clear).

Materially different: swap/cascade vs gravity/lock/line-clear.

Overlay match / falling-block were **not** wired (P3-E local boards stay).

### ValidationPlan

1. Pack extras expose live `board` / `grid` / `active` for presentation. Unit tests cover the generated starter boards.
2. Generator: match and falling-block presets enable `sw2d.puzzle-rules`, emit the matching kind, no code-config seam.
3. Generated grid shell binds `bindStarterPuzzle` and hides the dummy actor when active.
4. Honesty / docsSync / uiCopy stay green. ADR-0036.
5. Real-browser play of factory-generated games. Overlay P3-E not re-run. Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Content authority remains `content/puzzles.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation.
- [x] ADR-0036.
- [x] Real-browser play of factory-generated `wave9-match-puzzle` / `wave9-falling-block-puzzle` (`tools/scripts/play-puzzle-boards-wave9.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-E re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `match` and `falling-block` kinds already live in `sw2d.puzzle-rules` (ADR-0023).
- Snapshot extras now include live `board` / `grid` / `active` cells so the HUD can draw without a parallel table.
- `bindStarterPuzzle` is INERT for sokoban / switch-sequence. `{ hud: false }` is unused this wave.
- Match: cursor `gridController.step`; CONFIRM select-or-adjacent-swap; CANCEL deselect then undo; SECONDARY reset. Warm-in 250 ms.
- Falling: L/R/D `move`, UP+CONFIRM `rotate`, SECONDARY `hard-drop`, gravity tick 450 ms, warm-in 250 ms.
- Generator must pass `presetId` into `generateUiCopy` or every grid `puzzle-rules` game inherits the sokoban hint.
- Overlay match / falling-block kits stay local (P3-E).
- `physics-puzzle` / `escape-room` stay on the `sw2d.puzzle` code seam.

### Browser journeys (executed)

Factory-generated (grid shell HUD):

- Match-puzzle: Space start → ArrowDown cursor (0,1) → Enter select → ArrowRight (1,1) → Enter swap → `clears` 9 / objective 3, `solved` true, 1 move.
- Falling-block-puzzle: Space start → ArrowRight×3 park 3-wide bar on the right → KeyK hard-drop → KeyK drop the next bar on the left → `lines` 1 / objective 1, `solved` true.

### Visual inspection

High-contrast Phaser HUD (`MATCH` / `FALLING BLOCK`, clears or lines, `MOVE WASD/ARROWS   ENTER SELECTS OR SWAPS   UNDO BACKSPACE` / `MOVE WASD/ARROWS   ENTER ROTATES   DROP K`). Dummy grid actor hidden when the board is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `falling-block-puzzle` catalog lag: generator/docs/tests switched to `sw2d.puzzle-rules` while the live `definePreset` still required `sw2d.puzzle` (honesty/generate/docsSync failed until the catalog caught up).
- `generateUiCopy` learned match/falling hints but `buildGameFiles` omitted `presetId`, so generated theme copy still said PUSH/UNDO/RESET K. The generator now forwards `presetId`.
- `starterPuzzle.ts` `selectedCol`/`selectedRow` needed a local null-narrow for `tsc`.

### Remaining blockers / unknowns

- No committed `proofs/` for match-puzzle or falling-block-puzzle; catalog maturity stays `recipe`.
- Overlay boards stay local. Pointer drag-swap and wall-kicks stay out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail camera, weapons leftover, run-meta vs survivor, Tier-4, committed proofs.
