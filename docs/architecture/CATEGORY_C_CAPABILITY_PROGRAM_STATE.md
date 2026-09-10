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
| 10 | Visual reaction / beat windows (not audio-sync) | reaction-timing, rhythm-action | **Wave 10 implemented and played** (`sw2d.timing` / `arcade.timing`, ADR-0037). Residual: music-beat/audio-synchronization. Overlay rhythm/reaction stay local (P3-F). |
| 11 | Consume existing weapons in vehicle + pointer shells | asteroids-shooter, gallery-shooter | **Wave 11 implemented and played** (existing `sw2d.weapons`; ADR-0038). Residual: rail-camera; rail keeps weapons leftover. Overlay shooters stay local. |
| 12 | Consume existing `sw2d.puzzle` code seam | physics-puzzle, escape-room | **Wave 12 implemented and played** (existing `sw2d.puzzle`; ADR-0039). Residual: rules stay TypeScript not content; no escape-room grammar. Overlay physics/escape stay local. |
| 13 | Consume existing `sw2d.simulation` ledger/jobs | farming-lite, colony-lite | **Wave 13 implemented and played** (existing `sw2d.simulation`; ADR-0040). Residual: crop/season/plot framework and colony assignment AI stay out. Overlay farming/colony stay local (P3-J). |
| 14 | Consume existing `sw2d.narrative` store | interactive-fiction-hybrid, investigation-game | **Wave 14 implemented** (existing `sw2d.narrative`; ADR-0041). Residual: parser IF and evidence-board linking stay out. Overlay IF/investigation stay local (P3-K). |
| 15 | Consume existing `sw2d.arcade` score/elapsed | fishing-game, cooking-game | **Wave 15 implemented** (existing `sw2d.arcade`; ADR-0042). Residual: casting/line/tension/fish behaviour and ingredient/recipe cooking stay out. Overlay fishing/cooking stay local (P3-H). Pinball/microgame stay dummy OPTIONS. |
| 16 | Consume existing ADR-0018 interaction in pointer shells | drawing-game, dress-up-character-toy | **Wave 16 implemented** (existing spatial pointer / drag-drop; ADR-0043). Residual: pressure/layers/export; attachment/skeleton wardrobe. Overlay drawing/dress-up stay local (P3-H). Wave 20 consumes the same service for photo vs sandbox. |
| 17 | Consume existing `sw2d.progression` XP/currency | survivor-like, action-roguelite | **Wave 17 implemented** (existing `sw2d.progression`; ADR-0044). Residual: difficulty scaling; permadeath. Overlay survivor/roguelite stay local (P3-C). |
| 18 | Consume existing `sw2d.strategy` teams/turns | turn-based-tactics, auto-battler | **Wave 18 implemented** (existing `sw2d.strategy`; ADR-0045). Residual: attack-range; autonomous combat; RTS box-select; territory capture. Overlay tactics/battler stay local. |
| 19 | Consume existing `sw2d.navigation` pathfinding | maze-game, lane-defense | **Wave 19 implemented** (existing `sw2d.navigation`; ADR-0046). Residual: fog-of-war; maze generation; spawn scheduling; combat; tower target-selection. Overlay maze/lane stay local. |
| 20 | Consume existing ADR-0018 in photo + sandbox | photography-game, sandbox-playground | **Wave 20 implemented** (existing spatial pointer / click; ADR-0047). Residual: camera/framing/scoring; generalized authoring. Overlay photography/sandbox stay local (P3-H). |
| 21 | Consume existing `sw2d.combat` health/damage | dungeon-crawler, base-defense | **Wave 21 implemented** (existing `sw2d.combat`; ADR-0048). Residual: generated Enemy objects / AI; target-priority. Overlay dungeon/base stay local. |
| 22 | Consume auto-run presentation in platform shells | auto-runner, endless-runner | **Wave 22 implemented** (no new pack; ADR-0049). Residual: climbing / chase-pressure; generated segment solids unused by the starter strip. Overlay runner kits stay local. |
| 23 | Consume vehicle.motion in road and craft shells | endless-driving, boat-flight-racer | **Wave 23 implemented** (no new pack; ADR-0050). Residual: kart item-fire. Overlay vehicle kits stay local. |
| — | Tier 4 specialized (parser IF, microgame scheduler) | prefer game-specific seam until a second consumer is real | backlog |

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

- No committed `proofs/` for matorkspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail camera, weapons leftover, run-meta vs survivor, Tier-4, committed proofs.

## Wave 10 — `sw2d.timing`

### Problem

`reaction-timing` and `rhythm-action` were dummy ui-simulation pickers. Arcade
elapsed/score is not a reaction-test or a beat window. Audio-sync is a
different machine and stays out of contract. Overlay rhythm/reaction already
have local proofs — leave them unwired (P3-F).

### Consumers

- `reaction-timing` — mode `reaction` (deterministic delay, too-early miss, latency window).
- `rhythm-action` — mode `rhythm` (periodic visual beats, in-window hit, miss-on-late).

Materially different: one-shot delay+false-start vs repeating visual metronome.

### ValidationPlan

1. Contract + schema (`TimingCatalog` / `timing-catalog`) reject unknown modes.
2. Pack unit tests: reaction go/hit/false-start/timeout; rhythm in-window hit / late miss / complete-on-hits; missing document inert; empty delays inert; dispose; reset; dt=0.
3. Generator: all 74 emit schema-valid `content/timing.json`; the two consumers enable `sw2d.timing` and a non-empty catalog; `src/content.ts` passes `'timing': timingData`; `main.ts` installs `timingPack`.
4. Generated ui-simulation shell binds `bindStarterTiming` and skips the dummy picker when active.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy allowlist stay green.
6. Workbench `POST /api/timing/inspect`.
7. Overlay rhythm/reaction **not** bound (P3-F local journeys).
8. Real-browser journeys against factory-generated games. Committed `proofs/` + maturity promotion still deferred.

### CompletionContract

- [x] Reusable pack in `@sw2d/packs`, renderer-neutral.
- [x] Content authority `content/timing.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused unit/integration tests.
- [x] Honest residual limitation (audio-sync is not this pack).
- [x] ADR-0037.
- [x] Real-browser play of factory-generated `wave10-reaction-timing` / `wave10-rhythm-action` (`tools/scripts/play-timing-wave10.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-F re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- Capability id `arcade.timing`. Pack id `sw2d.timing`. Not folded into `sw2d.arcade`.
- Empty catalog (hitsToWin 0 or empty delays/period) is inert. No duplicate-id error (schedules are arrays, not named cues).
- Reaction: delays `[700, 700]`, window 400 ms, maxWait 900 ms, hitsToWin 2. False-start restarts the same delay. Timeout miss after maxWait.
- Rhythm: period 500 ms, offset 700 ms, window ±120 ms, hitsToWin 3. Early press before the window is a miss that does not consume the beat; late close auto-misses.
- Generated `src/main.ts` must both import and install `timingPack`. `content.ts` unquoted key is `timing: timingData`.
- Overlay rhythm/reaction kits do not bind (P3-F).
- `LIMITATIONS.visualTiming` names what is reusable and what is not.
- `POST /api/timing/inspect` must be a real route (import-only fails `noUnusedLocals`).

### Browser journeys (executed)

Factory-generated (ui-simulation shell HUD):

- Reaction-timing: Space start elapsed 446 wait → GO at 712 → Enter hit latency 17 hits 1 → GO at 1446 → Enter complete hits 2 latency 33, 0 misses.
- Rhythm-action: Space start elapsed 445 wait → three in-window Enter hits (latencies 71 / 88 / 71) → hits 3 outcome=complete, 0 misses.

### Visual inspection

High-contrast Phaser HUD (`REACTION` / `RHYTHM`, hits/misses, WAIT/GO circle, `WAIT FOR THE GO   ENTER HITS` / `ENTER ON THE BEAT`). Dummy picker hidden when timing is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Generate test initially asserted quoted `'timing': timingData`; the template uses the identifier form `timing: timingData`.
- Honesty `/sw2d\\.timing/` over-escaped and failed to match `sw2d.timing`.
- `inspectTiming` import without a route failed `noUnusedLocals`.

### Remaining blockers / unknowns

- No committed `proofs/` for reaction-timing or rhythm-action; catalog maturity stays `recipe`.
- Overlay rhythm/reaction stay local. Audio-sync stays out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail camera, weapons leftover, run-meta vs survivor, remaining Tier-4, committed proofs.

## Wave 11 — consume `sw2d.weapons` in vehicle and pointer shells

### Problem

`asteroids-shooter` and `gallery-shooter` still carried
`LIMITATIONS.weaponsProjectiles` after Phase 3 shipped `sw2d.weapons`. The
generated platform and top-down shells already bind `bindStarterWeapon`. The
vehicle and pointer shells did not. The leftover was consumption, not a
missing pack. Rail-shooter's identity gap is a rail-path camera, not another
fire adapter.

### Consumers

- `asteroids-shooter` — vehicle heading-fire on `PRIMARY_ACTION` (J/X).
- `gallery-shooter` — pointer cursor-aimed fire on `PRIMARY_ACTION` or click.

Materially different: ship-heading projectiles vs origin-to-cursor projectiles.

`rail-shooter` was **not** wired — pointer-shell fire is inert unless the pack
is installed. Overlay asteroids/gallery/rail kits stay local.

### ValidationPlan

1. No new pack / schema / capability id.
2. Catalog: asteroids and gallery require `sw2d.weapons`; rail does not.
3. Generated vehicle shell binds `bindStarterWeapon`, skips dummy ground
   collision in open space, fires along heading.
4. Generated pointer shell binds `bindStarterWeapon`, fires toward
   `spatialPointer`, keeps dummy click for non-weapon pointer games.
5. Honesty / docsSync / catalogPackIntegrity / uiCopy stay green. ADR-0038.
6. Real-browser play of factory-generated games. Overlay shooters not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Content authority remains `content/weapons.json`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (rocks/gallery waves/rail camera).
- [x] ADR-0038.
- [x] Real-browser play of factory-generated `wave11-asteroids-shooter` / `wave11-gallery-shooter` (`tools/scripts/play-weapons-wave11.ts`, 2/2 PASS, 0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay shooter re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.** Gallery stays proof-validated on the frozen proof.

### Implementation notes

- No new pack. `sw2d.weapons` / `bindStarterWeapon` already exist (ADR-0020).
- Fire is not vehicle intent (ADR-0009). The vehicle shell reads
  `PRIMARY_ACTION` directly; `VehicleIntent` stays steering/throttle/boost.
- Asteroids open-space: hide the proof-level ground strip and spawn at centre
  so the dummy Solid does not pin the ship (found while writing the shell;
  play confirmed spawn 480,270 and throttle x 480→512 speed 190).
- Gallery keeps a visible dummy target; click-to-toggle is skipped while
  weapons are active so a click fires instead. KeyJ fires toward the cursor
  (default 0,0 aims up).
- Frozen `proofs/gallery-shooter/` is not regenerated. Gallery stays
  proof-validated on that evidence.
- Overlay shooter kits stay local.

### Browser journeys (executed)

Factory-generated:

- Asteroids-shooter: Space start at centre 480,270 sidearm 0 shots → ArrowUp throttle x 512 speed 190 → KeyJ projectilesSpawned 1 live 1.
- Gallery-shooter: Space start sidearm 0 shots pointer 0,0 → KeyJ projectilesSpawned 1 live 1.

### Visual inspection

Ship flies in open space (dummy ground hidden) and fires along heading.
Gallery gun at the bottom fires toward the cursor; dummy click-toggle is off.
Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Parallel StrReplace on `contentDocuments.ts` duplicated the tail of
  `generateTiledLevel` and dropped the vehicle FIRE hint. Restored before
  generate tests.
- Dummy proof-level ground strip would pin an asteroids ship. Open-space
  path hides walls and centres the spawn.

### Remaining blockers / unknowns

- No committed `proofs/` for asteroids-shooter; gallery proof stays the frozen
  Phase-1 click-target game. Catalog maturity unchanged (23/3/48).
- Overlay shooters stay local. Rail-camera leftover remains on `rail-shooter`,
  which still carries `LIMITATIONS.weaponsProjectiles`.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, run-meta vs survivor, remaining Tier-4, committed proofs.

## Wave 12 — consume `sw2d.puzzle` in the pointer shell

### Problem

`physics-puzzle` and `escape-room` still required `sw2d.puzzle`. The generated
packConfig was a 3-move counter the pointer shell never called, so both recipes entered
play as a dummy click target. The leftover was consumption, not a missing
pack. Inventing a new puzzle pack would duplicate ADR-0017 / ADR-0023.

### Consumers

- `physics-puzzle` — `{ kind: 'physics-goal', inGoal }` (Matter ball, click/J
  nudges, solved when the ball crosses x≥740 on the floor).
- `escape-room` — `{ kind: 'escape-locks', note, key }` (note hotspot, then
  gated key; `isSolved` when both flags are set).

Materially different: rigid-body goal vs linked inspect locks.

Overlay physics-puzzle / escape-room kits stay local (P3-E / P3-K).

### ValidationPlan

1. No new pack / schema / capability id.
2. Generated packConfig is physics-goal vs escape-locks, not a shared counter.
3. Generated pointer shell presents both kinds on `puzzle.state`.
4. Honesty / docsSync / uiCopy stay green. ADR-0039.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Code-seam authority remains `src/game-specific/packConfig.ts`.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (`puzzleConfigIsCode` + escape-room grammar).
- [x] ADR-0039.
- [x] Real-browser play of factory-generated `wave12-physics-puzzle` /
  `wave12-escape-room` (`tools/scripts/play-puzzle-seam-wave12.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-E / P3-K re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.puzzle` / `configSource: 'code'` already exist (ADR-0017).
- Pointer shell branches on `puzzle.current().kind`. Dummy click + demo Matter
  ball stay for pointer games that do not install the pack (physics-toy).
- Physics: `setVelocity(10, -4)` on PRIMARY_ACTION or click; `apply({ inGoal })`
  when the body is past the goal. Floor + left wall via AdvancedPhysicsService.
- Escape: note at 240,280; key at 480,280 (locked until note); door at 720,280
  (visual). Clicking the locked key records `lastResult: 'locked'`.
- Overlay kits stay local.
- `LIMITATIONS.puzzleConfigIsCode` stays: these rules are TypeScript, not
  `content/puzzles.json`.

### Browser journeys (executed)

Factory-generated:

- Physics-puzzle: Space start ball 200,492 on the floor, solved false → KeyJ
  nudge 1 → 90 frames ball x 817, `inGoal` true, `solved` true, lastResult=goal.
- Escape-room: Space start note/key false → click key 480,280 lastResult=locked
  → click note 240,280 note true → click key key true, solved true.

### Visual inspection

Physics: visible ball, floor, goal; HUD `BALL x  GOAL 740  NUDGES n` then
`SOLVED`. Escape: three hotspots, HUD `NOTE N/Y  KEY N/Y` then `ESCAPED`.
Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- First Chrome start this session omitted `swiftshader.tar.br`; EGL failed and
  CDP `newPage` SIGTRAPed. Inflating SwiftShader to `/tmp` restored play.
- `timeout 90 npm run sw2d -- validate` still hangs after printed PASS (exit
  124). Same as Waves 8–11; not a Wave-12 regression.

### Remaining blockers / unknowns

- No committed `proofs/` for physics-puzzle or escape-room; catalog maturity
  stays `recipe` (23/3/48).
- Overlay physics-puzzle / escape-room stay local. No content-authored
  escape-room grammar.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, run-meta vs survivor, remaining Tier-4, committed proofs.

## Wave 13 — consume `sw2d.simulation` in farm and colony shells

### Problem

`farming-lite` and `colony-lite` already required `sw2d.simulation`. The
generated ui-simulation shell never bound it, so both recipes entered play as
dummy OPTIONS. The leftover was consumption, not a missing pack. Inventing a
crop/season pack would duplicate a 1-consumer leftover. Extending
`sw2d.simulation` into farms/colonies would make a genre monolith.

### Consumers

- `farming-lite` — `SIMULATION_STARTER = 'farm'` (plant / grow / harvest three
  plots; complete at 3 crops).
- `colony-lite` — `SIMULATION_STARTER = 'colony'` (assign two workers to gather,
  spend 2 materials on one construct job; complete when the hall is built).

Materially different: plot plant/harvest vs worker assignment + construction.

Overlay farming / colony kits stay local (P3-J).

### ValidationPlan

1. No new pack / schema / capability id.
2. Generated packConfig stamps `SIMULATION_STARTER` farm vs colony vs null.
3. Generated ui-simulation shell binds `bindStarterSimulation` and skips the
   dummy picker when active.
4. Honesty / docsSync / uiCopy stay green. ADR-0040.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `simulation.resources` ledger + jobs.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (crop/season framework; assignment AI /
  construction placement).
- [x] ADR-0040.
- [x] Real-browser play of factory-generated `wave13-farming-lite` /
  `wave13-colony-lite` (`tools/scripts/play-simulation-wave13.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-J re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.simulation` already exists (resource ledger + timed jobs).
- `bindStarterSimulation` is INERT unless packConfig names `'farm'` or
  `'colony'` *and* `simulation.resources` is installed. Idle-incremental stays
  on its frozen proof; shop/kitchen/factory stay on `sw2d.economy`.
- Farm: `queueJob('grow-N', 480)` then harvest `addResource('crops', 1)`.
- Colony: gather jobs add materials; construct costs 2 and queues `construct`.
- Scene restart zeros resources and cancels starter job ids (the pack is
  game-lifetime, not scene-lifetime).
- Overlay farming/colony kits stay local (P3-J authored plots/jobs).

### Browser journeys (executed)

Factory-generated:

- Farming-lite: Space start 3 empty plots, crops 0 → Enter plants plot 0
  (`planted`, growing remaining 363) → 50 frames ripe → Enter harvest crops 1
  → ArrowRight plant/harvest plot 1 crops 2 → plot 2 harvest crops 3
  outcome=complete.
- Colony-lite: Space start materials 0 → ArrowRight×2 Enter `need-materials`
  → ArrowLeft×2 Enter assign worker 0 busy → 50 frames materials 1 gathered →
  ArrowRight assign worker 1 → materials 2 → ArrowRight Enter constructing →
  50 frames built true, outcome=complete.

### Visual inspection

Farm: three plot rectangles EMPTY / GROWING / RIPE, HUD `crops n/3`, title
`HARVESTED` on complete. Colony: two worker rectangles plus BUILD HALL, HUD
`materials n`, title `BUILT` on complete. Dummy picker hidden when the binder
is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Parallel StrReplace on `uiSimulationShellPack.ts` dropped the `jobs.active`
  update loop while keeping bind/dispose. Restored before play.
- `timeout 90 npm run sw2d -- validate` still hangs after printed PASS (exit
  124). Same as Waves 8–12; not a Wave-13 regression.

### Remaining blockers / unknowns

- No committed `proofs/` for farming-lite or colony-lite; catalog maturity
  stays `recipe` (23/3/48).
- Overlay farming/colony stay local. Crop/season/plot framework and colony
  assignment AI stay out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, run-meta vs survivor, remaining dummy OPTIONS (pinball/auto-battler/
  microgame/fishing/cooking), maze wanderer, committed proofs.


## Wave 14 — consume `sw2d.narrative` in IF and investigation shells

### Problem

`interactive-fiction-hybrid` and `investigation-game` already required
`sw2d.narrative`. The generated shells never bound it, so IF entered play as
dummy OPTIONS and investigation as a top-down wanderer. The leftover was
consumption, not a missing pack. Inventing a parser or evidence-board pack
would duplicate 1-consumer leftovers. Folding either into `sw2d.dialogue`
would lie about parser commands and evidence linking.

### Consumers

- `interactive-fiction-hybrid` — `NARRATIVE_STARTER = 'fiction'` (LOOK / TAKE /
  LEAVE menu verbs; TAKE locked until LOOK sets `saw-note`; TAKE and LEAVE are
  two endings).
- `investigation-game` — `NARRATIVE_STARTER = 'case'` (walk to two clue
  markers, J inspects `markSeen`, walk to desk, J deduces).

Materially different: keyboard verb menu vs spatial inspect-then-deduce.

Overlay IF / investigation kits stay local (P3-K).

### ValidationPlan

1. No new pack / schema / capability id. `narrative.reset()` is scene-lifetime.
2. Generated packConfig stamps `NARRATIVE_STARTER` fiction vs case vs null.
3. Generated ui-simulation shell binds fiction verbs. Generated top-down shell
   binds case clues.
4. Honesty / docsSync / uiCopy stay green. ADR-0041.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `narrative.state` node/flag/choice/seen store.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy/pack tests.
- [x] Honest residual limitation (parser IF; evidence-board linking).
- [x] ADR-0041.
- [x] Real-browser play of factory-generated `wave14-interactive-fiction-hybrid` /
  `wave14-investigation-game` (`tools/scripts/play-narrative-wave14.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-K re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.narrative` already exists (node / flags / choose / seen).
- `bindStarterNarrative` is INERT unless packConfig names `'fiction'` or
  `'case'` *and* `narrative.state` is installed. Visual-novel / point-and-click
  stay on `sw2d.dialogue`. Museum stays optional narrative.
- Fiction verbs LOOK/TAKE/LEAVE. TAKE without `saw-note` records `locked`.
- Case clues at (280,270) and (620,270); desk at (850,270); spawn (120,270).
- Scene restart calls `narrative.reset()` (the pack is game-lifetime).
- Overlay IF / investigation kits stay local (P3-K).

### Browser journeys (executed)

Factory-generated:

- Interactive-fiction-hybrid: Space start node=`start` LOOK → ArrowRight
  Enter TAKE `locked` → ArrowLeft Enter LOOK `saw-note` node=`looked` →
  ArrowRight Enter TAKE ending=`escaped` outcome=complete.
- Investigation-game: Space start x=120 clues 0/2 → J `too-far` → walk
  x=237 near print, J `inspected` seen print → walk x=575 near photo, J
  `inspected` 2/2 → walk x=795 near desk, J `deduced` ending=`closed`
  outcome=complete.

### Visual inspection

Fiction: HUD `FICTION`, cabin text, `< LOOK > TAKE LEAVE`, then `ESCAPED`.
Case: PRINT / PHOTO / DESK markers, HUD `CASE` clues n/2, then `CASE CLOSED`.
Dummy picker hidden when the binder is active. Confirmed via debug snapshots,
not screenshots.

### Bugs found and fixed this wave

- Investigation catalog limitation edit missed on the first pass (`docsSync`
  still expected the old evidence-board-only string).
- Unused `EMPTY_COLOR` in `starterNarrative.ts` failed `tsc` (`noUnusedLocals`).

### Remaining blockers / unknowns

- No committed `proofs/` for IF-hybrid or investigation; catalog maturity
  stays `recipe` (23/3/48).
- Overlay IF / investigation stay local. Parser and evidence-board stay out.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, run-meta vs survivor, remaining dummy OPTIONS (pinball/auto-battler/
  microgame), maze wanderer, committed proofs.

## Wave 15 — consume `sw2d.arcade` in fishing and cooking shells

### Problem

`fishing-game` and `cooking-game` already required `sw2d.arcade`. The
generated ui-simulation shell never bound it, so both recipes entered play as
dummy OPTIONS. The leftover was consumption, not a missing pack. Inventing a
fishing or cooking pack would duplicate 1-consumer leftovers. Folding fishing
into `sw2d.timing` would lie about reaction/beat windows.

### Consumers

- `fishing-game` — `ARCADE_STARTER = 'fishing'` (cast, wait on `elapsedMs`,
  land in the bite window or miss, `addScore` per catch; complete at 2 fish).
- `cooking-game` — `ARCADE_STARTER = 'cooking'` (arrows pick FLOUR/EGG/MIX;
  confirm matching `[0,1,2]`; complete at 3 correct steps with
  `addScore(100 - 20 * mistakes)`).

Materially different: timed bite window vs ordered recipe.

Pinball-lite, microgame-collection, rhythm and reaction keep
`ARCADE_STARTER = null`. Overlay fishing / cooking kits stay local (P3-H).

### ValidationPlan

1. No new pack / schema / capability id. Arcade has no `reset()`; binder zeros
   score via `addScore(-score)` and uses relative `elapsedMs` snapshots.
2. Generated packConfig stamps `ARCADE_STARTER` fishing vs cooking vs null.
3. Generated ui-simulation shell binds `bindStarterArcade` and skips the dummy
   picker when active.
4. Honesty / docsSync / uiCopy stay green. ADR-0042.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `arcade.score` ledger.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (casting/tension/fish; recipe cooking).
- [x] ADR-0042.
- [x] Real-browser play of factory-generated `wave15-fishing-game` /
  `wave15-cooking-game` (`tools/scripts/play-arcade-wave15.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-H re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.arcade` already exists (score / combo / lives / elapsed).
- `bindStarterArcade` is INERT unless packConfig names `'fishing'` or
  `'cooking'` *and* `arcade.score` is installed. Pinball / microgame stay dummy
  OPTIONS. Rhythm / reaction stay on `sw2d.timing`.
- Fishing CAST 480 ms (playable; overlay is 1200), BITE 700, LAND 200, catch 2,
  50 points each.
- Cooking recipe `[0,1,2]`, wrap select, wrong does not advance, dish score
  `100 - 20 * mistakes`.
- Overlay fishing / cooking kits stay local (P3-H).

### Browser journeys (executed)

Factory-generated:

- Fishing-game: Space start idle score 0 → Enter `cast` → bite at elapsed 741
  → wait miss `missed` 1 → Enter recast bite → Enter `landed` caught 1 score 50
  → idle → Enter bite → Enter `landed` caught 2 score 100 outcome=complete.
- Cooking-game: Space start FLOUR step 0 → ArrowRight EGG Enter `wrong`
  mistakes 1 → ArrowLeft Enter FLOUR `added` step 1 → ArrowRight Enter EGG
  step 2 → ArrowRight Enter MIX `ready` score 80 outcome=complete.

### Visual inspection

Fishing: water rectangle CAST / WAITING / BITE / LANDED, HUD `caught n/2`,
title `CAUGHT` on complete. Cooking: three ingredient rectangles, HUD
`step n/3`, title `DISH READY` on complete. Dummy picker hidden when the
binder is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- None during play. Validate without `PLAYWRIGHT_CDP_URL` reports no Chrome
  (same as prior waves); with CDP, 4× PASS then hang (exit 124).

### Remaining blockers / unknowns

- No committed `proofs/` for fishing-game or cooking-game; catalog maturity
  stays `recipe` (23/3/48).
- Overlay fishing/cooking stay local. Casting/tension and recipe cooking stay
  out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, run-meta vs survivor, remaining dummy OPTIONS (pinball/auto-battler/
  microgame), maze wanderer, committed proofs.

## Wave 16 — consume ADR-0018 in drawing and wardrobe shells

### Problem

`drawing-game` and `dress-up-character-toy` already sat on the pointer shell
(`context.spatialPointer` / `context.interaction`, ADR-0018). Both recipes
entered play as a dummy click target. Inventing a drawing-canvas pack or a
wardrobe/attachment pack would duplicate 1-consumer leftovers.

### Consumers

- `drawing-game` — `POINTER_STARTER = 'draw'` (drag polylines on the page;
  a stroke counts at ≥80 px; complete at 2 strokes).
- `dress-up-character-toy` — `POINTER_STARTER = 'wardrobe'` (drag hat and
  shirt onto a figure drop zone; complete when both are attached).

Materially different: stroke capture vs drag/drop slots.

Sandbox, photography, physics-toy, gallery and rail keep
`POINTER_STARTER = null`. Overlay drawing / dress-up kits stay local (P3-H).

### ValidationPlan

1. No new pack / schema / capability id.
2. Generated packConfig stamps `POINTER_STARTER` draw vs wardrobe vs null.
3. Generated pointer shell binds `bindStarterPointer` and skips the dummy
   target when active.
4. Honesty / docsSync / uiCopy stay green. ADR-0043.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing ADR-0018 interaction service.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (pressure/layers/export; skeleton wardrobe).
- [x] ADR-0043.
- [x] Real-browser play of factory-generated `wave16-drawing-game` /
  `wave16-dress-up-character-toy` (`tools/scripts/play-pointer-wave16.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-H re-run. **Not done this wave** — overlay stays unwired.
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `context.interaction` already exists (ADR-0018).
- `bindStarterPointer` is INERT unless packConfig names `'draw'` or
  `'wardrobe'`. Physics-toy / sandbox / gallery / rail stay dummy or their
  own binders.
- Drawing: paper rect 80,80 800×380; min stroke 80 px; two strokes complete.
- Wardrobe: hat (200,160) and shirt (200,340) drop onto figure (700,270).
- Overlay drawing / dress-up kits stay local (P3-H).

### Browser journeys (executed)

Factory-generated:

- Drawing-game: Space start mode=`draw` strokes 0 → drag 200,200→520,200
  lastResult=`stroke` strokes 1 length 320 outcome=playing → drag 200,320→520,320
  strokes 2 length 640 outcome=complete.
- Dress-up-character-toy: Space start mode=`wardrobe` attached [] → drag hat
  200,160→700,200 lastResult=`drop-hat` attached [hat] → drag shirt 200,340→700,300
  lastResult=`drop-shirt` attached [hat, shirt] outcome=complete.

### Visual inspection

Drawing: paper rectangle, two polylines, HUD `strokes n/2`, title `DRAWN` on
complete. Wardrobe: hat/shirt rectangles and figure drop zone, HUD `on n/2`,
title `DRESSED` on complete. Dummy click target hidden when the binder is
active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `generatePackConfig` computed `pointerStarter` but never emitted
  `POINTER_STARTER`, so generated shells would fail tsc on the import.
- `drawing-game` catalog/docs still claimed no stroke capture (docsSync).
- `hatX`/`hatY`/`shirtX`/`shirtY` inferred as numeric literals from `as const`
  rack positions (`tsc`).
- `outcome === 'complete'` after `if (outcome !== 'playing') return` was a
  narrowing contradiction (`tsc`).
- Pointer shell dispose omitted `pointerPlay.dispose()`.

### Remaining blockers / unknowns

- No committed `proofs/` for drawing-game or dress-up-character-toy; catalog
  maturity stays `recipe` (23/3/48).
- Overlay drawing/dress-up stay local. Pressure/layers/export and
  attachment/skeleton wardrobe stay out of contract.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory, pinball, crop/season, rail
  camera, remaining dummy OPTIONS (pinball/microgame), maze wanderer,
  photography/sandbox, overlay wiring, committed proofs, simple-rts leftover
  (realtime box-select, not turns).

## Wave 17 — consume `sw2d.progression` in survivor and roguelite shells

Shipped in `78ad697` (ADR-0044). `survivor-like` ticks in-run XP; `action-roguelite`
walks to relics. No new pack. Catalog maturity unchanged. Play:
`tools/scripts/play-progression-wave17.ts`.

## Wave 18 — consume `sw2d.strategy` in tactics and battler shells

### Problem

`turn-based-tactics` and `auto-battler` already required `sw2d.strategy`. The
generated shells never bound it, so tactics entered play as a dummy grid
wanderer and battler as dummy OPTIONS. The leftover was consumption, not a
missing pack. Inventing attack-range or autonomous-combat packs would duplicate
1-consumer leftovers. Pairing simple-rts would lie: that leftover is realtime
box-select, not `strategy.turns`. Territory leftover is capture-zones.

### Consumers

- `turn-based-tactics` — `STRATEGY_STARTER = 'tactics'` (J selects scout, arrows
  move the unit, occupy FLAG at col 12).
- `auto-battler` — `STRATEGY_STARTER = 'battler'` (arrows pick FOX/BEAR/OWL,
  Enter strikes via `combat.health` CPU health 2, CPU auto-`advanceTurn` ~400ms).

Materially different: discrete select-then-step occupation vs menu pick-and-strike.

Simple-rts and territory-control keep `STRATEGY_STARTER = null`. Overlay tactics /
auto-battler kits stay local.

### ValidationPlan

1. No new pack / schema / capability id. Strategy is game-lifetime: register
   teams only if empty; heal CPU on rebind.
2. Generated packConfig stamps `STRATEGY_STARTER` tactics vs battler vs null.
3. Generated grid shell binds tactics and hides the wanderer. Generated
   ui-simulation shell binds battler and skips dummy OPTIONS.
4. Honesty / docsSync / uiCopy stay green. ADR-0045.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `strategy.turns` teams/select/advanceTurn.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (attack-range; autonomous combat).
- [x] ADR-0045.
- [ ] Real-browser play of factory-generated `wave18-turn-based-tactics` /
  `wave18-auto-battler` (`tools/scripts/play-strategy-wave18.ts`).
- [ ] `npm run sw2d -- validate` on those two games.
- [ ] Overlay re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.strategy` already exists (teams / active turn / selection /
  turn advance).
- `bindStarterStrategy` is INERT unless packConfig names `'tactics'` or
  `'battler'` *and* `strategy.turns` is installed.
- Tactics: scout (8,8), flag (12,8), grunt (20,8). J on scout selects. Arrows
  move the selected unit. Occupy flag completes and `advanceTurn`s.
- Battler: FOX/BEAR/OWL wrap. Enter `select`s the fighter and `damage('cpu', 1)`.
  Complete at cpu health 0. CPU turn skips strikes and auto-passes at 400 ms.
- Do not claim capture-zones or autonomous combat from teams/select/advanceTurn.
- Overlay tactics / auto-battler kits stay local.

### Browser journeys (executed)

Factory-generated:

- Turn-based-tactics: Space start mode=`tactics` team=player turn 1 cursor/unit
  (8,8) → ArrowRight `aim` cursor 9 unit 8 → KeyJ `empty` → ArrowLeft KeyJ
  `selected` scout → ArrowRight×4 `seized` unit (12,8) outcome=complete.
- Auto-battler: Space start mode=`battler` FOX cpu 2 → ArrowRight BEAR → Enter
  `hit` cpu 1 team=cpu → Enter `wait` → ~400ms `cpu-pass` team=player → Enter
  `won` cpu 0 outcome=complete.

### Visual inspection

Tactics: SCOUT / FLAG / GRUNT rectangles, HUD `turn n · player · scout`, title
`SEIZED` on complete. Battler: FOX/BEAR/OWL slots, HUD `cpu n/2`, title `WON`
on complete. Dummy wanderer / OPTIONS hidden when the binder is active.
Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- `generatePackConfig` computed `strategyStarter` but the first emit of
  `STRATEGY_STARTER` missed the return array (`tsc` unused). Same class as
  Wave 16's `POINTER_STARTER` miss.
- Tactics catalog limitation row lagged the live `knownLimitations` (`docsSync`).

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48). `turn-based-tactics` remains
  proof-validated on the frozen proof.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), maze wanderer,
  photography/sandbox, overlay wiring, committed proofs, simple-rts leftover
  (realtime, not turns). Next wave: **done** — Wave 19 navigation (see below).

## Wave 19 — consume `sw2d.navigation` in maze and lane shells

### Problem

`maze-game` was a dummy grid wanderer and did not require `sw2d.navigation`.
Generated `lane-defense` already required the pack (and has a frozen proof)
but the factory shell never bound it, so it entered play as the same wanderer.
The leftover was consumption, not a missing pack. Inventing fog-of-war, spawn
scheduling or combat packs would duplicate 1-consumer leftovers. Restyling
Wave 18 tactics as pathfinding would change the FLAG-seize contract.

### Consumers

- `maze-game` — `NAV_STARTER = 'maze'` (arrows step only onto `isWalkable`
  cells; complete occupying EXIT at col 12).
- `lane-defense` — `NAV_STARTER = 'lane'` (autonomous `RouteFollower` to BASE;
  J places a blocker; a trapping placement rolls back; complete on arrival).

Materially different: player-controlled occupancy vs autonomous re-path.

Tower-defense, turn-based-tactics and simple-rts keep `NAV_STARTER = null`.
Overlay maze / lane-defense kits stay local.

### ValidationPlan

1. No new pack / schema / capability id. Navigation is game-lifetime: remove
   and redefine the starter grid on each scene install.
2. Generated packConfig stamps `NAV_STARTER` maze vs lane vs null.
3. Generated grid shell binds maze/lane and hides the wanderer.
4. Honesty / docsSync / uiCopy stay green. ADR-0046.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `world.navigation` grid/path service.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (fog-of-war / maze generation; spawn/combat).
- [x] ADR-0046.
- [x] Real-browser play of factory-generated `wave19-maze-game` /
  `wave19-lane-defense` (`tools/scripts/play-navigation-wave19.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [ ] `npm run sw2d -- validate` on those two games.
- [ ] Overlay re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.navigation` already exists (A* / reachable / blockers /
  `RouteFollower`, ADR-0022).
- `bindStarterNavigation` is INERT unless packConfig names `'maze'` or
  `'lane'` *and* `world.navigation` is installed.
- Maze corridor: (4,8)→(6,8)↓(6,10)→(10,10)↑(10,8)→(12,8). ArrowUp from start
  is a wall. `findPath` length 13 at start.
- Lane: runner (4,8)→BASE (16,8), cursor starts (10,8). J blocks; detour via
  row 6. Route-destroying placements roll back.
- Do not claim spawn waves or combat from path-follow + occupancy.
- Overlay maze / lane-defense kits stay local.

### Browser journeys (executed)

Factory-generated:

- Maze-game: Space start cell 4,8 path 13 → ArrowUp `wall` still 4,8 →
  ArrowRight×2 cell 6,8 `moved` → down/right/up/right corridor → cell 12,8
  `escaped` outcome=complete.
- Lane-defense: Space start mode=`lane` cursor 10,8 runner on the straight
  lane → KeyJ `placed` blocks 1 path 11→18 (detour via row 6) → runner
  arrives 16,8 `arrived` outcome=complete.

### Visual inspection

Maze: corridor floor tiles, EXIT marker, HUD `cell c,r · path n`, title
`ESCAPED` on complete. Lane: runner rectangle, cursor, BASE marker, HUD
`runner c,r · path n · blocks n`, title `BREACHED` on complete. Dummy
wanderer hidden when the binder is active. Confirmed via debug snapshots,
not screenshots.

### Bugs found and fixed this wave

- Lane play first asserted the runner was still on the spawn cell after the
  12-frame start warm-in. The follower already advances during those frames
  (240 px/s). Assertions now require the runner still be on the lane before
  the mid-lane cursor, and that placing a blocker increases `pathLength`.

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48). `lane-defense` remains
  proof-validated on the frozen proof.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), overlay wiring, committed
  proofs, simple-rts leftover (realtime box-select, not turns), tower
  target-selection, attack-range, autonomous combat, museum exhibit/codex.
  Next wave: **done** — Wave 20 photo/sandbox (see below).

## Wave 20 — consume ADR-0018 in photo and sandbox shells

### Problem

`photography-game` entered play as a dummy top-down wanderer.
`sandbox-playground` entered play as a dummy pointer click target. Wave 16
already consumed ADR-0018 for drawing and wardrobe and rejected these two as
a third `POINTER_STARTER` consumer. Inventing a camera/framing pack or a
generalized authoring sandbox would duplicate 1-consumer leftovers. Folding
either into arcade, narrative or puzzle would lie about the genre.

### Consumers

- `photography-game` — `TOY_STARTER = 'photo'` (walk to BIRD then TREE; J
  captures in range; too-far is rejected; complete at 2 shots).
- `sandbox-playground` — `TOY_STARTER = 'sandbox'` (click stamps BLOCK or
  BALL; arrows pick the kind; click a stamp to remove; complete when one of
  each exists).

Materially different: walk-into-range capture vs click-to-stamp two kinds.

Drawing, dress-up, physics-toy, gallery, rail and museum keep
`TOY_STARTER = null`. Overlay photography / sandbox kits stay local (P3-H).

### ValidationPlan

1. No new pack / schema / capability id.
2. Generated packConfig stamps `TOY_STARTER` photo vs sandbox vs null.
3. Generated top-down shell binds photo and skips dummy wander fire.
   Generated pointer shell binds sandbox and skips the dummy target.
4. Honesty / docsSync / uiCopy stay green. ADR-0047.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing ADR-0018 interaction service.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (camera/framing; generalized authoring).
- [x] ADR-0047.
- [x] Real-browser play of factory-generated `wave20-photography-game` /
  `wave20-sandbox-playground` (`tools/scripts/play-toy-wave20.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on those two games (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
- [ ] Overlay P3-H re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `context.interaction` already exists (ADR-0018).
- `bindStarterToy` is INERT unless packConfig names `'photo'` or `'sandbox'`.
- Photo: spawn (120,270); BIRD (280,270); TREE (700,270); range 64.
- Sandbox: stage 80,140 800×340; palette BLOCK/BALL; max 6 stamps.
- Overlay photography / sandbox kits stay local (P3-H).

### Browser journeys (executed)

Factory-generated:

- Photography-game: Space start x=120 mode=`photo` shots 0 → KeyJ `too-far` →
  walk x=237 near bird, J `shot-bird` shots 1 → walk x=648 near tree, J
  `shot-tree` shots 2 captured [bird, tree] outcome=complete.
- Sandbox-playground: Space start mode=`sandbox` selected=block 0/0 → click
  400,280 `stamp-block` blocks 1 → ArrowRight `pick-ball` → click 600,280
  `stamp-ball` blocks 1 balls 1 outcome=complete.

### Visual inspection

Photo: BIRD / TREE markers, HUD `shots n/2`, title `CAPTURED` on complete.
Sandbox: BLOCK/BALL palette plus stage, HUD `block n · ball n`, title `BUILT`
on complete. Dummy wander fire / dummy click target hidden when the binder
is active. Confirmed via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- Top-down and pointer shells used `TOY_STARTER` before importing it from
  packConfig (`tsc`).
- Pointer shell bound `bindStarterToy` but never called `toy.select` /
  `toy.render`, so ArrowLeft/Right would not pick BLOCK vs BALL.

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48).
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), overlay wiring, committed
  proofs, simple-rts leftover (realtime box-select, not turns), tower
  target-selection, attack-range, autonomous combat, museum exhibit/codex.

## Wave 21 — consume `sw2d.combat` in dungeon and base shells

### Problem

`dungeon-crawler` and `base-defense` already required `sw2d.combat`. The
generated top-down shell never bound it, so both recipes entered play as dummy
wanderers. The leftover was consumption, not a missing pack. Inventing
targeting or AI-path packs would duplicate 1-consumer leftovers. Pairing
simple-rts would lie: that leftover is realtime box-select, not health/damage.

### Consumers

- `dungeon-crawler` — `COMBAT_STARTER = 'room'` (walk to GRUNT then BRUTE; J
  strikes in range; contact damages the player; complete when both foes die).
- `base-defense` — `COMBAT_STARTER = 'hold'` (two raiders march on BASE; J
  strikes; contact damages the base; complete when both raiders die with the
  base alive).

Materially different: player-HP room clear vs base-HP holdout.

Simple-rts, territory-control, action-adventure and arena keep
`COMBAT_STARTER = null`. Overlay dungeon / base-defense kits stay local.

### ValidationPlan

1. No new pack / schema / capability id. Combat is game-lifetime: remove and
   re-register starter ids on each scene install.
2. Generated packConfig stamps `COMBAT_STARTER` room vs hold vs null.
3. Generated top-down shell binds room/hold and skips dummy wander fire.
4. Honesty / docsSync / uiCopy stay green. ADR-0048.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains the existing `combat.health` register/damage/invuln.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (generated Enemy objects / AI; target-priority).
- [x] ADR-0048.
- [x] Real-browser play of factory-generated `wave21-dungeon-crawler` /
  `wave21-base-defense` (`tools/scripts/play-combat-wave21.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on dungeon-crawler (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
  base-defense tsc PASS; play already proved the loop.
- [ ] Overlay re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. `sw2d.combat` already exists (entity-keyed health/damage).
- `bindStarterCombat` is INERT unless packConfig names `'room'` or `'hold'`
  *and* `combat.health` is installed.
- Room: spawn (140,270); GRUNT (400,270); BRUTE (680,270); HP 2; strike range
  110; contact 28 damages the player with 600 ms i-frames.
- Hold: spawn (480,270); raiders (160,180) and (160,360) march at 36 px/s on
  BASE (820,270) HP 3; contact damages the base, not the player.
- Do not claim targeting, pathfinding, or generated Enemy objects.
- Overlay dungeon / base-defense kits stay local.

### Browser journeys (executed)

Factory-generated:

- Dungeon-crawler: Space start x=140 mode=`room` foes 2 hp 5 → KeyJ `miss` →
  walk x=301 near grunt, J×2 `kill-grunt` foes 1 → walk x=580 near brute,
  J×2 `cleared` foes 0 outcome=complete, playerHealth 5.
- Base-defense: Space start x=480 mode=`hold` base 3 foes 2 → KeyJ `miss` →
  walk x=260 near raider, J×2 `kill-raider` foes 1 → near raider-2, J×2
  `cleared` foes 0 outcome=complete, baseHealth 3.

### Visual inspection

Room: GRUNT / BRUTE rectangles, HUD `hp n · foes n`, title `CLEARED` on
complete. Hold: two RAIDER rectangles plus BASE, HUD `base n · foes n`, title
`HELD` on complete. Dummy walls hidden when the binder is active. Confirmed
via debug snapshots, not screenshots.

### Bugs found and fixed this wave

- None during play. First journey 2/2 PASS.

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48). `dungeon-crawler` remains
  proof-validated on the frozen proof.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), overlay wiring, committed
  proofs, simple-rts leftover (realtime box-select, not turns), tower
  target-selection, attack-range, autonomous combat, museum exhibit/codex,
  camera/framing, generalized authoring. Next wave: **done** — Wave 22 auto-run
  (see below).

## Wave 22 — consume auto-run in course and endless shells

### Problem

`auto-runner` and `endless-runner` already required `sw2d.generation` and
`sw2d.arcade`. The generated platform shell still let the player walk, so a
factory endless-runner was not auto-running. Wave 8 already rejected pairing
these two via `sw2d.stage-scroll`. Inventing a climbing or chase pack would
duplicate 1-consumer leftovers.

### Consumers

- `auto-runner` — `RUN_STARTER = 'course'` (constant +X, Space jumps the gap,
  complete occupying FLAG at x 820 on the ground).
- `endless-runner` — `RUN_STARTER = 'endless'` (same auto-run and gap;
  `arcade.addScore` from distance; complete at score 80).

Materially different: reach-the-flag course vs survive-and-score endless.

Climbing-game, chase-platformer and collectathon keep `RUN_STARTER = null`.
Overlay runner kits stay local.

### ValidationPlan

1. No new pack / schema / capability id.
2. Generated packConfig stamps `RUN_STARTER` course vs endless vs null.
3. Generated platform shell binds course/endless, hides generated ground,
   auto-runs, and jumps on Space.
4. Honesty / docsSync / uiCopy stay green. ADR-0049.
5. Real-browser play of factory-generated games. Overlay kits not re-run.
   Committed proofs + maturity promotion still deferred.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Auto-run is game-specific presentation on the platform shell.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (climbing / chase-pressure; starter strip
  vs generated solids).
- [x] ADR-0049.
- [x] Real-browser play of factory-generated `wave22-auto-runner` /
  `wave22-endless-runner` (`tools/scripts/play-run-wave22.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [x] `npm run sw2d -- validate` on auto-runner (schema + tsc + vite
  build + boot smoke) PASS (CDP hang after printed success, timeout 90 → 124).
  Both games tsc PASS; play already proved the loop.
- [ ] Overlay re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Implementation notes

- No new pack. Do not invent a runner, climbing, or chase engine.
- `bindStarterRun` is INERT unless packConfig names `'course'` or `'endless'`.
  Endless also requires `arcade.score`.
- Authored strip: left floor 0–280, gap 280–360, right 360–960, start
  (100,458), FLAG x 820, fail y>510. Generated NormalizedLevel solids stay
  unused by the starter strip.
- Auto +X 260 px/s. Space jumps. Course complete x≥820 onGround. Endless
  scores 1 per 8 px and completes at 80.
- Overlay runner kits stay local.

### Browser journeys (executed)

Factory-generated:

- Auto-runner: Space start x≈156 mode=`course` jumps 0 → wait x≈208, Space
  `jump` 1 → x=828 onGround `finished` outcome=complete.
- Endless-runner: Space start x≈152 mode=`endless` score 6 → wait x≈204,
  Space `jump` 1 → x=746 score 80 `survived` outcome=complete.

### Visual inspection

Course: two floor pads plus FLAG, HUD `x n · jumps n`, title `FINISHED` on
complete. Endless: same pads, HUD `score n/80`, title `SURVIVED` on complete.
Dummy walk hidden when the binder is active. Confirmed via debug snapshots,
not screenshots.

### Bugs found and fixed this wave

- First play assertion required spawn x=100 after the 12-frame start warm-in.
  Auto-run already advances (~156). Assertions now allow x in (90, 220).
- Jump-clearance at 220 px/s was ~2 px short of the right pad. Auto +X is 260.

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48). `endless-runner` remains
  proof-validated on the frozen proof.
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), overlay wiring, committed
  proofs, simple-rts leftover (realtime box-select, not turns), tower
  target-selection, attack-range, autonomous combat, museum exhibit/codex,
  camera/framing, generalized authoring. Next wave: **done** — Wave 23
  vehicle road/craft (see below).

## Wave 23 — consume vehicle.motion in road and craft shells

### Problem

`endless-driving` already required `sw2d.vehicles` + `sw2d.arcade` +
`sw2d.generation`. The generated vehicle shell never called `arcade.addScore`.
`boat-flight-racer` already emits `starter-boat` and `starter-flight`, but the
shell loaded only `definitionIds()[0]`. Inventing kart item-fire would
duplicate a 1-consumer leftover. Kart already races.

### Consumers

- `endless-driving` — `VEHICLE_STARTER = 'road'` (throttle, arcade distance,
  complete at score 80).
- `boat-flight-racer` — `VEHICLE_STARTER = 'craft'` (J loads `starter-flight`,
  hold Up+Shift climbs, complete at altitude 80).

Materially different: distance score vs boat-to-flight altitude.

Kart-racer, time-trial and asteroids keep `VEHICLE_STARTER = null`. Overlay
vehicle kits stay local.

### CompletionContract

- [x] No new pack / schema / capability id.
- [x] Authority remains `vehicle.motion` + `arcade.score` + the boat catalog.
- [x] ≥2 materially different generated consumers (2 wired).
- [x] Focused generate/honesty/uiCopy tests.
- [x] Honest residual limitation (kart item-fire).
- [x] ADR-0050.
- [x] Real-browser play of factory-generated `wave23-endless-driving` /
  `wave23-boat-flight-racer` (`tools/scripts/play-vehicle-wave23.ts`, 2/2 PASS,
  0 console errors, 0 external requests).
- [ ] Overlay re-run. **Not this wave.**
- [ ] Committed proofs + maturity promotion. **Not done — evidence rule.**

### Browser journeys (executed)

Factory-generated:

- Endless-driving: Space start x=160 mode=`road` score 0 → hold ArrowUp
  x=812 speed 340 score 80 `distance` outcome=complete.
- Boat-flight-racer: Space start mode=`craft` profile=`boat` alt 0 → KeyJ
  profile=`flight` lastResult=`flight` → hold ArrowUp+ShiftLeft alt 84
  `airborne` outcome=complete.

### Bugs found and fixed this wave

- None during play. First journey 2/2 PASS.

### Remaining blockers / unknowns

- Catalog maturity stays unchanged (23/3/48).
- Chrome wrapper is session-local under `/tmp`.
- Do not commit `package-lock.json` workspace links for gitignored `games/wave*`.
- Residual Category-C: climbing, chase, territory capture, pinball, crop/season,
  rail camera, dummy OPTIONS (pinball/microgame), overlay wiring, committed
  proofs, simple-rts leftover (realtime box-select, not turns), tower
  target-selection, attack-range, autonomous combat, museum exhibit/codex,
  camera/framing, generalized authoring, kart item-fire.

