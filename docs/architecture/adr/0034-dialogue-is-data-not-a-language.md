# ADR-0034: A dialogue is data, not a language — and it owns the script, not the state

- Status: Accepted
- Date: 2026-08-30
- Phase: Post-ten program Phase 20 (Narrative Dialogue, Choices & Portraits)
- Supersedes: none
- Related: [ADR-0011](0011-capability-namespacing.md), [ADR-0032](0032-agent-needs-are-authored-vocabulary.md), [ADR-0033](0033-one-item-system-one-wallet-one-clock.md)

## Context

Four presets need branching conversation: `visual-novel` and `point-and-click` as their
primary loop, `interactive-fiction-hybrid` and `investigation-game` alongside something
else. All four already declared a `dialogue` content role with no schema behind it, and all
four carried a limitation saying no content-authored branching dialogue renderer existed.

Dialogue is the system most likely to grow a scripting language. The pressure is real: a
writer wants a choice to appear only when `trust > 3 && !metJoss`, and the shortest path is
a string field and an expression evaluator. It works immediately and it is very hard to
undo, because once a condition can be arbitrary code the document stops being data: the
Workbench cannot show it, validation cannot check the references inside it, a save file
becomes a script, and a translator has to be careful not to break logic.

The second pressure is toward owning state. A dialogue naturally accumulates flags — who
was met, what was said, what was given — and it is easy for it to become a second place
where the game's world state lives, drifting from `world.state` and `progression.state`.

The third is the typewriter. Revealing text a character at a time is the genre's signature
effect, and the obvious implementation — append one character per tick — makes the line
genuinely absent from the accessibility tree until the animation finishes, and makes a
screen reader announce a growing fragment over and over.

## Decision

1. **Conditions and effects are closed declarative unions.** Seven condition kinds
   (narrative flag, world flag, progression unlock, seen node, seen line, choice count, item
   count) and six effect kinds (set narrative flag, set world flag, grant item, remove item,
   progression adjustment, mark seen, world transition). There is no expression string and
   no evaluator. Adding an eighth kind is a deliberate edit to the union *and* the schema,
   which is the point of it being closed.

2. **The dialogue owns the script; it owns none of the state.** Every effect writes through
   the capability that owns what it touches. A missing owner **skips the effect and names
   it** (`{ kind, reason: 'missing-capability', capability }`) rather than failing silently,
   so a game that forgot `sw2d.items` learns it from the effect report and not from a
   player noticing they never got the key.

   The one subtlety worth stating: `seen-node` / `seen-line` read the dialogue's **own**
   history because they ask about the shape of this conversation, while the `mark-seen`
   *effect* writes a codex entry into `narrative.state` because that is a fact about the
   game. Two different questions that happen to share a word.

3. **Ids are never text.** Every line and choice carries a stable id distinct from its text.
   Save records hold ids only. A proofreading pass must not be able to invalidate a save,
   and a translation must not be able to change what a condition matches.

4. **The typewriter never hides text.** The whole line is written into the DOM the instant
   it is shown; the reveal is a **clip**, not an append. The proof asserts this against the
   real accessibility tree, reading `textContent` before a single frame of reveal has run.
   Reduced motion skips the reveal entirely rather than merely speeding it up.

5. **The reveal runs on simulation time.** `tick(deltaMs)` from the game's frame, not
   `setInterval`. A timer-driven reveal keeps painting while the game is paused and while
   the tab is throttled — the same class of mistake Phase 17 rejected for rhythm charts —
   and it cannot be asserted on deterministically.

6. **No focus trap.** The overlay is `role="region"`, not `role="dialog"`: a modal dialog
   role implies trapped focus, and the game is still running behind the conversation. Choice
   buttons are ordinary buttons in document order.

7. **Portraits are optional and named by asset role.** A character with no `portraits` is
   valid and a zero-art build stays valid. An unknown expression falls back to the default
   rather than blanking the character, because a typo in one line should not remove a face
   for the rest of the scene.

8. **Advancing is caller-driven.** There is no `update()` on the service and none on the
   installed pack: a conversation moves when the player asks it to. The only thing that
   needs a frame is the reveal animation, and that lives in the overlay.

## Consequences

- The four presets narrow their limitations to the honest remainder: anything a game wants
  that is not one of the seven condition kinds or six effect kinds stays game-specific, and
  no localisation platform, voice-over pipeline or branching-graph editor ships.
- A game whose choice genuinely needs arbitrary logic cannot express it in the document.
  That is the intended cost. The escape hatch is an ordinary flag: the game computes
  whatever it likes and sets a narrative flag the dialogue can read.
- The Workbench lab edits **text** — lines, choice text, character names — and *reports* the
  graph. Spec 20.11 forbids universal visual scripting, and a form for rewiring a condition
  graph is exactly that. What it adds instead is the thing JSON hides: which nodes nothing
  can reach.
- `role="region"` means assistive technology does not announce the overlay as a modal. That
  is correct here and would be wrong for a genuinely blocking modal; a future pause menu
  must not copy this choice without re-deciding it.
- Portrait asset roles come from the canonical theme role union, which has no
  portrait-specific role today. The visual-novel proof therefore names existing roles
  (`player`, `enemy`, `pickup`). Widening the theme vocabulary is a decision for a certifier
  or for Phase 36, not something this phase takes unilaterally.
