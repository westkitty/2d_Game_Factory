# Cloud Chaser (`westkitty/c_chase`) Reference Extraction

Inspected read-only on 2026-08-24 via the GitHub API and raw file fetch. Nothing was cloned
with a writable remote; `c_chase` was not modified and never will be by this project.

**Sources inspected**

| File | Size | Used for |
|---|---:|---|
| `cloud_chaser_seattle_remastered_final/cloud_chaser_playable.html` | 822,952 B / 6,316 lines | runtime architecture, `CFG` tuning block (offset 8,908) |
| `cloud_chaser_seattle_remastered_final/UX_PLAYABILITY_AUDIT.md` | 25,409 B | verified defects and what the audit says already works |
| `README.md` | 8,809 B | system inventory, accessibility options, licensing status |
| `.../references/uploaded_visual_simplification_pass/CONTROLS_ACCESSIBILITY.md` | 1,263 B | control and rebinding model |
| `.../references/uploaded_visual_simplification_pass/TIMING_MATRIX.md` | 1,003 B | difficulty-target methodology |
| `cloud_chaser_seattle_remastered_final/asset_manifest.json` | 3,891 B | asset inventory shape |

Cloud Chaser is a **behavioural donor, not an architectural one**. Its 6,316-line single-file
runtime is the specific failure mode this factory exists to avoid.

---

## PRESERVE
### Proven feel worth porting, value-for-value

- **Movement math.** The audit independently confirms this is "modern-platformer correct":
  gravity `0.82`, run accel `0.78`, ground friction `0.78`, air friction `0.94`, max run `6.1`,
  jump `-14.4`, double jump `-13.2`, coyote `0.11s`, jump buffer `0.13s`, full air control.
  Apex ~0.29s, ~2.3 body-heights. Captured verbatim in
  [§ Tuning profile](#tuning-profile-chase-platformer-cloud-chaser-like) below.
- **Damage feedback stack.** Hit-stop (0.06 / 0.08 / 0.12s by severity), squash/stretch
  impulse, screen flash, shake, knockback, invulnerability (`hurtInvuln 1.0`,
  `respawnInvuln 1.2`), scattered recoverable pickups, death slow-motion (`timeScale 0.15`).
  The audit's verdict - juice that clarifies rather than decorates - is the bar to hold.
- **A chase mechanic that bites instead of instant-killing.** Storm damage plus pushback
  (`stormPushback 112`) with a damage cooldown (`stormDamageCooldown 1.05`) is a mercy design
  worth generalising.
- **Checkpoints with generous, fair placement**, respawn with invulnerability, swept X-then-Y
  collision against solids, one-way ledges, springs.
- **Engineering hygiene.** Hardened storage and asset loading that never crashes at boot, an
  explicit fatal-error screen, a `__cloudChaserQA` snapshot, and a boot-time self-check.
  Already honoured: `LocalStorageDriver` degrades instead of throwing, `SaveStoreImpl` recovers
  from corrupt JSON, and `__SW2D__.snapshot()` is the direct descendant of the QA hook.
- **Accessibility breadth.** Remappable keys for *every* action, assist mode, practice mode,
  a screen-shake scale (not a boolean), reduced motion, high-contrast outlines, auto-pause on
  tab hide, touch controls, gamepad mapping. Already honoured: shake is a 0..1 scale,
  reduced motion forces it to 0, and tab-hide auto-pauses.

## GENERALIZE
### Behaviour that should become a reusable system, not a Cloud Chaser feature

| Cloud Chaser behaviour | Factory home |
|---|---|
| Coyote time, jump buffer, double jump, variable jump, air control | platform controller family (Phase 3) |
| Hit-stop, squash/stretch, shake, knockback, i-frames, damage flash | combat pack + a shared feedback/juice service (Phase 4) |
| Storm wall as pursuing pressure | a generic "pursuit pressure" system: a threat with position, speed, catch distance, damage cooldown, grace windows, and rubber-banding. `chase-platformer` configures it; it is not storm-shaped in the core. |
| Checkpoints, respawn, spawn grace | world pack (Phase 4) |
| Score, combo, chain, rank thresholds, local best times | arcade pack (Phase 4) |
| Powerups with timed durations | progression pack (Phase 4) |
| Boss phases keyed to HP with staged tutorialisation | AI pack (Phase 4). The audit calls the boss level the best-designed one - the staged-by-HP idea is the transferable part. |
| Ghost/replay stored locally | arcade pack hooks; storage already namespaced and versioned |
| Assist mode and practice mode | accessibility + tuning overlays, not bespoke branches |
| Rebinding for every action | already structural: `ActionBindings` covers all 12 semantic actions |
| Touch button layout | already structural: DOM `data-sw2d-action` controls feed the same action layer |

**Spawn-grace lesson, adopted as a design rule.** The audit verified an idle player dies in
4-7 seconds at spawn in *every* storm level, including the tutorial one. Pursuit pressure must
therefore be suppressible during non-interactive intro, briefing and respawn windows. Cloud
Chaser has the fields for this (`stormGraceT`) and still ships the failure, so the factory
should make the grace window part of the pressure system's contract rather than a per-level
afterthought.

## GAME-SPECIFIC
### Cloud Chaser identity. Never enters the runtime.

Seattle landmarks (Pike Place, Space Needle, Gas Works, Fremont Troll, Monorail); the storm
fantasy and its wording; clouds as the collectible; gust/Cloud Blow; the flask; route stamps;
red clouds; Breezy assist naming; the SNES/cabinet presentation; per-level MP3 tracks; splash
and title art; the six-level campaign and its timing matrix.

**Licensing.** The `c_chase` README states no formal software license is attached and that
audio/visual clearance is unconfirmed. **No Cloud Chaser asset may enter this repository.**
The `chase-platformer` proof uses original placeholder visuals unless the user explicitly
brings in assets they control. Only the numeric tuning values below - facts about game feel,
inspected and attributed - are carried over.

## DO NOT CARRY FORWARD
### Architectural debt and verified defects

1. **The single-file runtime.** 6,316 lines of HTML/JS with embedded data URIs. This is the
   architecture the factory exists to replace. Nothing is ported structurally.
2. **Double input consumption.** The audit's #1 finding: one physical keypress consumed twice,
   once by the `keydown` handler and once by the `requestAnimationFrame` loop, because both
   read the same `pressed` set before it was cleared. It broke pause, level select, the entire
   briefing system, and the mute/ghost/debug toggles. **Directly answered by the Phase 1
   architecture**: one owner advances input per frame, and `consumePress()` gives an edge
   exactly one consumer. Phase 1 hit the same class of bug on its first browser run and it was
   fixed structurally rather than patched - see [ADR-0003](adr/0003-semantic-input-ownership.md).
3. **System bloat.** ~18 overlapping meta-systems (gust, flask, chain, combo, rush, fever,
   stamps, red clouds, bonus stars, route medal, trick gates, caches, switch blocks, dash
   panels, cannons, updrafts, scout, reserve) plus 7 procedural generators sprinkling objects
   onto hand-authored levels. The audit is explicit that this density is a liability. Packs
   must be opt-in and a preset must justify each one.
4. **Economies that fight each other.** Punishment rewards moving (the storm); rewards require
   stopping (stamps, caches, off-route collectibles). A pressure system and a exploration
   system in one preset need an explicit reconciliation, not two independent tunings.
5. **Cue rings that hide the art.** High-contrast markers drawn over nearly every entity *by
   default*, so the playfield reads as a debug overlay. Accessibility cues must be opt-in,
   must not occlude the sprite they describe, and must be a theme concern.
6. **A global `ctx.font` setter override with size-rescaling heuristics**, mixing two webfonts.
   Fragile and a network dependency. The factory uses system font stacks and no font
   monkey-patching.
7. **Mobile as an afterthought.** Verified at 375x812: tiny letterboxed canvas, JUMP button
   clipped offscreen, controls detached from the canvas. Phase 1 validated the same viewport
   with on-screen controls present, unclipped, and 56px.
8. **Content errors that erode trust.** Off-by-one splash art (every level shows the previous
   level's), objective text truncated mid-word by `slice(0, 32)`, negative best times, a
   "PRESS START" baked into artwork that also renders a real prompt over it. These are
   validation gaps: schemas and content validation exist in this factory to catch that class.
9. **A fail screen that does not name the cause of death.** Error and outcome reporting must
   identify what happened.
10. **Firebase hosting config and a release workflow.** Out of scope; releases here are
    self-contained static bundles.

---

## Tuning profile: `chase-platformer-cloud-chaser-like`

Extracted verbatim from the `CFG` object in `cloud_chaser_playable.html` on **2026-08-24**.
Units are the original per-frame values at that game's fixed step - they are a *starting
preset*, not engine defaults, and Phase 3 must convert them to the factory's time base and
re-verify feel.

```jsonc
{
  "gravity": 0.82, "runAccel": 0.78, "groundFriction": 0.78, "airFriction": 0.94,
  "maxRun": 6.1, "jumpVel": -14.4, "doubleJumpVel": -13.2, "doubleJumps": 1,
  "coyote": 0.11, "jumpBuffer": 0.13,
  "attackTime": 0.36, "strikeStart": 0.13, "strikeEnd": 0.24, "strikeRange": 86,
  "attackBounce": -7.8, "stompBounce": -11.0,
  "hurtInvuln": 1.0, "respawnInvuln": 1.2,
  "cameraLead": 92,
  "hitStop": { "light": 0.06, "normal": 0.08, "heavy": 0.12 },
  "pursuit": {
    "startX": -260, "lagBase": 530, "lagPerCollectible": 54, "catchDistance": 18,
    "pushback": 112, "marginDecay": 20, "marginMax": 380, "damageCooldown": 1.05
  }
}
```

Two caveats the audit documents and any port must respect:

- `cameraLead: 92` exists in `CFG` but is **never applied to the camera target**. The camera is
  a spring-damper follow (stiffness 16, damping 3.6) with no look-ahead, and dash panels at
  14.8 px/frame outrun the view. Treat look-ahead as unimplemented, not as tuned.
- Pursuit creeps at a constant ~78 px/s at all times, including during the intro read-in. The
  grace-window rule above exists because of this.
