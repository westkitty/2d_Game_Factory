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
| 2 | Creature needs / behavior / relationship | pet-creature, aquarium-terrarium, virtual-pet (colony-lite only if the contract genuinely fits — it currently does not) | **next** |
| 3 | Branching dialogue / narrative presentation | visual-novel, point-and-click; investigation/museum only if the contract fits | backlog |
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
- Next wave: creature needs (pet / aquarium / virtual-pet) unless a re-audit finds a higher multiplicative cluster.
