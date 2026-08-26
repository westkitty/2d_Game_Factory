# Demo matrix

Twelve committed, representative demo games (`demos/<preset-id>/`), one per genre family
(platforming, top-down action, shooter, vehicle/movement, puzzle/arcade, strategy/defense x2,
simulation/management, narrative/exploration - see `packages/presets/src/catalog/` for the full
family list), each generated through the exact same path as `sw2d new` and then extended with
real, game-specific logic proving its preset's defining mechanic. Each has a committed real-browser
smoke test (`packages/qa/specs/*.ts`) that runs Chrome via `playwright-core` against a real
production build - not a typecheck-only or screenshot-only check.

Run all twelve (plus both starter journeys) with:

```bash
npm run qa:smoke
```

This is what promoted these twelve preset ids, and only these twelve, to
`maturity: 'smoke-validated'` (`packages/presets/test/honesty.test.ts` enforces the exact list).
The other 62 presets remain `'recipe'`.

| Preset | Family | Defining mechanic proven | Smoke spec |
|---|---|---|---|
| `traditional-platformer` | platforming | Platform movement, jump, hazard/reset, collectible, reachable exit | `traditionalPlatformer.ts` |
| `chase-platformer` | platforming | Movement, a real advancing chase-pressure state that pauses with the game, reachable finish/fail | `chasePlatformer.ts` |
| `metroidvania` | platforming | Movement, one real ability/unlock flag, a previously-blocked path becomes traversable, objective reachable only after unlock | `metroidvania.ts` |
| `twin-stick-shooter` | top-down action | Independent movement **and** aim (ADR-0016 - not last-move-direction), primary action fires a projectile, target takes damage, score/clear | `twinStickShooter.ts` |
| `stealth-game` | top-down action | Patrol/guard state, real distance-based detection, objective reachable unseen, alarm on detection | `stealthGame.ts` |
| `bullet-hell` | shooter | Movement, a deterministic radial projectile pattern, survival/clear, bounded projectile lifecycle | `bulletHell.ts` |
| `top-down-racer` | vehicle/movement | Throttle and steering as independent inputs, three ordered checkpoints, lap completion, restart | `topDownRacer.ts` |
| `sokoban` | puzzle/arcade | Grid movement, box push, invalid-push rejection, solved condition, reset, exact undo | `sokoban.ts` |
| `tower-defense` | strategy/defense | Fixed enemy route, grid-cursor tower placement (keyboard - spatial pointer stays deferred), currency cost, one wave, tower damage, reachable outcome | `towerDefense.ts` |
| `turn-based-tactics` | strategy/defense | Two sides, select unit, legal-range move, attack/damage, turn advance | `turnBasedTactics.ts` |
| `idle-incremental` | simulation/management | Deterministic passive production, a job/queue action, one upgrade, save/reload persistence proven across a **real browser navigation** | `idleIncremental.ts` |
| `visual-novel` | narrative/exploration | Visible DOM dialogue/speaker, one real choice, a branch/flag change, one ending | `visualNovel.ts` |

## What each demo is (and isn't)

Every demo's `src/game-specific/shellPack.ts` is real, hand-written game logic - not a template
stamped out with placeholder behavior. Where a preset's own pack cores don't fully cover its
smoke contract, the demo says so honestly rather than faking it:

- **`sokoban`** does not select `sw2d.puzzle` in its `content/game.json` - `PuzzleConfig` requires
  TypeScript functions, which cannot be expressed in JSON content. The demo implements the same
  `current`/`apply`/`undo`/`reset`/`isSolved` shape directly. Full finding:
  [`PHASE8_OPUS_GATE_B_HANDOFF.md` §8](../architecture/PHASE8_OPUS_GATE_B_HANDOFF.md#8-architectural-finding-sw2dpuzzles-config-is-not-json-serializable).
  **Phase 9 update:** the underlying gap is repaired - the pack declares `configSource: 'code'` and
  a generated game supplies its config from `src/game-specific/packConfig.ts`
  ([ADR-0017](../architecture/adr/0017-pack-config-source-json-or-code.md)), so all six presets
  requiring `sw2d.puzzle` now really install it. This demo still predates that path, so its
  `smoke-validated` status proves the *mechanic*, not the generated composition - the generated
  path is covered instead by
  [`tools/scripts/generated-runtime-matrix.ts`](../../tools/scripts/generated-runtime-matrix.ts).
- **`tower-defense`** places its one tower via a keyboard-driven grid cursor, not spatial pointer -
  the preset's own `knownLimitations` says so, and the Phase 8 directive explicitly allows
  keyboard/grid placement while spatial pointer stays deferred.
- **`twin-stick-shooter`**, **`bullet-hell`**, and **`tower-defense`** all use the same small
  `ProjectilePool` helper. Phase 8 copied it three times; **Phase 9 promoted it** - the three
  copies were byte-identical, which is strong evidence the interface was settled - to
  `packages/runtime/src/game-support/projectilePool.ts`, exported from `@sw2d/runtime`. It is
  deliberately game support, **not** a `@sw2d/packs` capability: no capability id, no config
  schema, no install order, and it touches Phaser sprites, which every renderer-independent pack
  core may not. Reasoning:
  [Gate B §7.5](../architecture/PHASE9_ARCHITECTURE_GATE_B.md).

## Not committed

`demos/<preset-id>/dist/`, `pack/`, and `node_modules/` are build artifacts and are not
committed - only source, content, and generated scaffolding are. `npm run qa:smoke` builds every
demo fresh with a real `vite build` before running its smoke spec, so the suite never depends on a
stale or hand-built `dist/`.
