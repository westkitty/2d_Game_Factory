# Proof Contract — breakout

Frozen before implementation. Post-ten program Phase 16 (ball & paddle arcade systems, ADR-0030).

## Preset

`breakout` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `top-down`,
required packs `sw2d.arcade`, **`sw2d.ball-paddle`**. Content roles `tuning`, **`ball-paddle`**.

## Reusable capability exercised

`arcade.ball-paddle` (`BallPaddleService`), driven entirely by the validated
`content/ball-paddle.json` (`urn:sw2d:schema:content-ball-paddle:v1`): the serve policy, the arena
and its edge behaviours, wall bounce, paddle bounce with hit-location steering, the per-hit speed
ramp and its clamp, brick hit points, brick destruction and scoring, canonical item drop ids, the
loss edge, lives, round reset and board-clear completion.

## What is deliberately game-specific

Presentation, and turning a controller intent into a paddle intent. The shell holds **no** ball
position, **no** brick hit points and **no** score — it reads them. It cannot advance the
simulation: `update()` is absent from `BallPaddleService`, and the shell observes through
`drainEvents()`.

The one test control, `parkPaddle(x)`, moves the paddle by ordinary intent and **refuses to run
while the ball is live**, so the rally is always played rather than staged.

## Terminal success/failure oracle

- **Success surface:** the shell debug snapshot — the simulation's full state (ball, paddles,
  bricks, scores, lives, status, winner) plus cumulative event counts, the last bounce's relative
  offset and the last item drop id.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 12-step verification)

The proof **plays**: the paddle tracks the ball with real arrow-key presses, exactly as a player
would. No step stages a position while the ball is live.

1. Boot: `sw2d.ball-paddle` installed, 15 bricks standing, 3 lives, score 0, ball parked and inert.
2. The paddle answers the controller and clamps at its authored `minTravel` — asserted before the
   serve, so nothing about the ball can confuse it, and the ball is confirmed still parked.
3. Serve: the ball leaves the serve point at the authored initial speed, upward per the policy.
4. Wall bounce: the ball's speed remains *entirely explained* by the serve speed plus one authored
   increment per paddle hit — however many walls it struck, none contributed anything.
5. A brick is destroyed and the score rises by the authored value.
6. A 2-hp brick logs a `brick-hit` before it dies, and reports its **canonical Phase-2 item id**
   (`coin-1`) on destruction.
7. Hit-location steering, sampled across several bounces: at least one is genuinely off-centre
   (`|relative| > 0.15`), every off-centre bounce sends the ball toward the side it was struck, and
   every bounce sends it back up the court. Sampling one bounce would not do — a centre hit
   legitimately returns straight, so a flat mirror would pass a single-sample check.
8. Speed ramp, measured from a **fresh round** (step 7 saturates the ball): the first two returns
   are exactly 338 and 356 (320 initial + 18 per hit), the sequence is non-decreasing, and nothing
   exceeds the authored 560 maximum.
9. With the paddle parked at the far left and no tracking, the ball reaches the loss edge, costs
   exactly one life, and parks; status becomes `round-over`.
10. `resetRound` re-centres the paddle and re-arms the serve **without** restoring cleared bricks or
    earned score.
11. Clearing the whole board completes the match with winner `player` and the authored total score
    of 225 (ten 1-hp bricks at 10 plus five 2-hp bricks at 25).
12. A completed match is inert: further serves and frames change nothing, and the ball is parked —
    `complete` alongside a live ball would be contradictory state.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Zero console errors, zero external requests.

## Negative-control verification

Each sabotage of `packages/packs/src/ballPaddle/ballPaddlePack.ts` was applied, observed, reverted:

| Sabotage | Result |
| --- | --- |
| hit-location steering removed (flat mirror) | step 7 FAIL, step 11 FAIL |
| brick hit points ignored (every brick dies on first contact) | step 6 FAIL, step 5 PASS |
| the loss edge no longer costs a life | step 9 FAIL |

The first control is also why step 7 was strengthened: in its original single-sample form it
survived that sabotage, because the sampled bounce happened to be near centre.
