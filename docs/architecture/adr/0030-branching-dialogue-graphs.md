# ADR-0030: Branching dialogue graphs are one reusable narrative-presentation capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 3

## Context

`visual-novel` and `point-and-click` carried the limitation that narrative
state existed but no content-authored branching dialogue graph / choice /
ending loop did. Both recipes needed the same underlying machine (nodes,
choices, flags, endings) with different start conditions: a novel auto-starts
and is keyboard-driven; an adventure stays idle until a hotspot starts a
conversation and may gate later hotspots on flags. Folding that into
`sw2d.narrative` would have turned a lightweight flag/node/seen store into a
genre monolith. Parser IF, portraits, scene composition and evidence-board
deduction do not fit this contract.

## Decision

**One renderer-neutral graph capability with two bounded modes. Not two
engines, and not a VN/portrait DSL.**

- **`sw2d.dialogue` → `narrative.dialogue`.** `DialogueService` owns
  `advance()` / `choose()` / `start()`, flags, `branch()`, `ending()`,
  `outcome()` and hotspot lock state. No Phaser, no wall clock, no RNG.
- **Two modes of one graph:**
  - `novel` — auto-starts `startConversationId`; confirm advances; arrows
    pick a choice; two authored endings.
  - `adventure` — idle until `start(conversationId)`; inspect nodes set
    flags without completing the game; a gated hotspot's ending node
    completes.
- **`content/dialogue.json`** (schema `dialogue-catalog`, document
  `dialogue`), always emitted. Empty/inert unless the preset installs the
  pack. The generator maps visual-novel → novel, point-and-click → adventure.
- **The generated `uiSimulationShellPack`** calls `bindStarterDialogue`
  after economy/needs. The generated `pointerShellPack` replaces the dummy
  click-target with authored hotspots when adventure mode is active.
- **Workbench:** `POST /api/dialogue/inspect` + a compact inspector (mode,
  conversations, hotspots). Read-only; editing is JSON work on the file.

## Consequences

- Consumers: `visual-novel` (novel), `point-and-click` (adventure). Both
  require `sw2d.dialogue` and content role `dialogue`.
- `LIMITATIONS.dialoguePresentation` names what is reusable and what is not.
  Twenty-two packs now have a preset consumer.
- Duplicate conversation/node/choice ids and unknown `next` ids throw at
  install. A missing document yields an inert service, not a crash. Locked
  `start()` and unknown choices are reported reasons, never silent no-ops.
- `bindStarterDialogue` resets the session on bind so a PlayScene restart is
  a new reading.
- Committed `proofs/point-and-click` is a frozen custom shell (lever/key
  drag) and is not regenerated from this template. Catalog maturity stays
  unchanged.

## Rejected

- **Folding this into `sw2d.narrative`.** That pack is a flag/node/seen
  store and explicitly is not a dialogue graph loader.
- **Portraits, scene composition, parser IF, evidence boards.** Those are
  not shared across these two recipes.
- **A scripting language.** Nodes, choices and flags are the whole grammar.
