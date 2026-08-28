Original prompt: This is supposed to be able to create games that are playable at the end. There is no option to play it. There is no option to like run Run the game. As it stands, I don't think it does create games. The UI is awkward and doesn't show what you've made. It doesn't show what you can do. It doesn't show how to use it. Each of these things need to be resolved. Stage commit and push against this.

Additional requirement: It also needs to validate and create sprite assets against the supplied images, which it does not do.

## 2026-08-28

- Confirmed the repository is nested at `2d_Game_Factory/` and is clean on `starter-kits/implement-all` tracking `origin/starter-kits/implement-all`.
- Root cause: the top-bar Preview action starts a game server but leaves the Asset Lab or Scene view mounted, so the running game is invisible.
- Root cause: the image-first flow imports and assigns source bytes directly; it never creates a purpose-tagged, validated sprite derivative.
- Implemented a visible Run Game path that switches to the live game dock, plus open-in-window play.
- Added a persistent four-step build track and redesigned the home/project surfaces around the actual image-to-play workflow.
- Image-first character and sprite-sheet flows now create a replayable derived PNG, validate its encoded pixels/dimensions/source lineage/recipe on the host, assign the validated derivative to the player role, and automatically run the game.
- Added per-sprite validation evidence in the inspector and readiness counts in the build track.
- Added runtime `render_game_to_text`, deterministic `advanceTime(ms)`, and F/Escape fullscreen support for every generated game.
- `npm run typecheck` passed after the first implementation pass.
- `npm run workbench:test` passed (127 tests) and `npm run workbench:build` passed.
- First `npm run qa:workbench` pass: 15/16 journeys passed, including the decisive image-to-validated-sprite-to-rendered-game journey. The responsive journey still expected the old top-bar label `Preview`; updated it to the new explicit `Run game` control before rerunning the same suite.
- Second `npm run qa:workbench` pass: 16/16 real-browser journeys passed at desktop, compact, and narrow widths.
- `npm run validate` passed: 92 files / 1,951 tests, typecheck, starter production build, and offline guard.
- Added direct sprite-validation regression tests; `npm run workbench:test` now passes 129/129.
- Ran the required gameplay client in headless and headed modes. Its SwiftShader canvas captures were black, but text state proved play, movement, jumping, damage, and the validated texture with zero captured game errors. Rechecked with the repository's system-Chrome path and visually confirmed the derived weasel sprite rendered in the playable scene.
- Visually inspected the redesigned home, editor/build track, live preview dock, and actual gameplay screenshots.

## TODO

- Stage only task files, commit, and push the current branch.
