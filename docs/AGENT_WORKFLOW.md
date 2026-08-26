# Agent Workflow

For coding agents and humans. Follow it in order.

## Every session starts here

1. Read [`OPERATIONAL_STATE.md`](../OPERATIONAL_STATE.md) - current phase, what is *verified*
   versus merely implemented, known gaps, protected invariants, and the next bounded action.
2. Read the relevant part of [`MASTER_PROJECT.md`](../MASTER_PROJECT.md). It is long; read the
   sections your task touches, not all of it.
3. Skim [`PROJECT_BIBLE.md`](../PROJECT_BIBLE.md) for decisions and lessons that affect your area.
4. Check `git status` and the current branch before changing anything.
5. Run the preflight:

```bash
npm install && npm run validate
```

`validate` = typecheck + unit tests + production build + offline guard. If it fails before you
have changed anything, fix or record that first - do not build on a broken baseline.

6. Continue from the **next bounded action** in `OPERATIONAL_STATE.md`. Not from a guess about
   what would be useful.

## Authority order

1. The newest explicit user instruction.
2. `MASTER_PROJECT.md`.
3. `OPERATIONAL_STATE.md`.
4. `PROJECT_BIBLE.md`.
5. Accepted ADRs in `docs/architecture/adr/`.
6. Verified tests and observed runtime behaviour.
7. Existing conventions in the code.
8. External documentation.
9. Inference.

External examples are evidence, not controlling architecture. Do not silently resolve an
important conflict - record it.

## While working

- **Inspect narrowly first.** Open the files your task names. Widen only when evidence requires.
- **Do not rewrite unrelated systems.** A change touching input, scene lifecycle, the system
  registry, the content loader, persistence or the build pipeline is cross-cutting; say so.
- **Do not add a dependency casually.** `MASTER_PROJECT.md` §20 and
  [`docs/architecture/DEPENDENCY_BASELINE.md`](architecture/DEPENDENCY_BASELINE.md) govern this.
  Record it before installing it.
- **Do not create a package or an abstraction without a consumer.** Two real consumers, or an
  immediate architectural requirement. Nothing else.
- **Respect the protected boundary.**

```text
NORMAL GAME WORK          RUNTIME WORK (justify, cover, re-verify)
content/**                packages/contracts/**
public/**                 packages/runtime/**
themes/**                 shared system packs
src/game-specific/**      shared controllers
```

If a game needs a new reusable extension: state why existing capability is insufficient, add the
smallest reusable piece, add regression coverage, rerun affected proofs.

## Validation, scaled to the change

| Change | Run |
|---|---|
| Docs only | nothing, or `npm run typecheck` if code samples changed |
| One package's internals | `npm run typecheck && npm test` |
| Anything the starter renders | add `npm run build` |
| Input, scene lifecycle, registry, content loader, persistence, shared collision, build | full `npm run validate` **and** the browser journey in [`docs/qa/PHASE1_VALIDATION.md`](qa/PHASE1_VALIDATION.md) |
| The CLI generator, a controller-family shell template, or a demo's game-specific logic | `npm run qa:smoke` (builds and real-browser-smokes every demo and both starter journeys - see [`docs/demos/DEMO_MATRIX.md`](demos/DEMO_MATRIX.md)) |

Do not run every proof game after a documentation change. Do run every affected proof after a
cross-cutting change. `npm run qa:smoke` is separate from `npm run validate` - it builds every
demo fresh and launches a real browser, so run it when something it actually covers changed, not
on every typecheck.

## When validation fails

1. Find the **earliest** meaningful failure, not the loudest.
2. Make **one** bounded, evidence-driven repair pass.
3. Rerun the affected checks.
4. If the same failure remains, **stop**. Record it accurately in `OPERATIONAL_STATE.md` under
   known failures. Do not thrash.

## Before claiming done

- Inspect the diff. `git diff --cached --stat` and actually read it.
- Nothing unrelated is staged.
- `OPERATIONAL_STATE.md` is updated: what is now *verified* (with evidence), what is merely
  implemented, what broke, what is still unknown, and the next bounded action.
- `PROJECT_BIBLE.md` gets an entry only if architecture or a real lesson changed.
- Report honestly. A file existing is not a feature. A build passing is not a working game. A
  registered preset is not a shipped genre.

## Escalating to Opus

Sonnet owns implementation. Escalate after **one** bounded repair pass when a genuine trigger
appears (`MASTER_PROJECT.md` §0B): a shared architecture boundary changes, three or more system
families are affected, a schema or API decision will constrain most future games, a proof exposes
an abstraction failure rather than a local bug, or a new major dependency or subsystem is needed.

Send a compact packet, not exploratory noise:

```text
affected invariant
earliest failing check
files/systems involved
what was attempted
why the issue appears architectural
smallest decision Opus needs to make
```

Do **not** escalate because a phase has many files, a preset family is large, tests need writing,
or documentation is lengthy.

## Before you run out of context

1. Leave the repository in the safest runnable state you can.
2. Update `OPERATIONAL_STATE.md`.
3. Append to `PROJECT_BIBLE.md` if architecture or evidence changed.
4. Record the exact next action.
5. Do not claim incomplete work is done.
