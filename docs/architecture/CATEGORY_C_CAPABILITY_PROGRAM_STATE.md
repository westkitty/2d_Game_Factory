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
| 4 | Stealth perception / suspicion / noise / hiding | stealth-game, heist-game | backlog |
| 5 | Ball / paddle / rebound | breakout, pong | backlog |
| 6 | Melee / knockback / hit-stun | action-adventure, arena-combat; run-and-gun only if it still needs it | backlog |
| 7 | Local multiplayer input ownership | local-party-game, pong | backlog |
| — | Tier 3 (rail camera, territory, chase, climbing, run-meta, falling-block, match consumption, crop/season) | re-audit before sharing | backlog |
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
- Next wave: stealth perception / suspicion / noise / hiding (stealth-game, heist-game) unless a re-audit finds a higher multiplicative cluster.
