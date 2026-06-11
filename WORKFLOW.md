# WORKFLOW.md - Fixing the open problems, phase by phase

This is the execution plan for paying down the defects found in `PLAYTEST.md`
(player-experience audit, all verified live against v1.0.0) and the still-open
items from `caveat.md` (code/physics audit). Each phase ends runnable: the
self-test (`tools/selftest-node.js` / `index.html?selftest`) must stay all-OK, and
a headless screenshot pass (`tools/playshot.html`) confirms the visual result.

Per the standing working agreement, we **pause for review at the end of every
phase** before starting the next.

## Status of the prior audits

Much of `caveat.md` has already been addressed in the working tree (deterministic
`PB.dcos`/`PB.dsin`, swept flipper `sweepResolve`, morph `depenetrate`, build-time
geometry assertion `_assertClear`, ball-pair collision, stepwise storage
`migration`, full key remapping incl. nudge/pause, single `PB.format.commas` in
`util.js`, cached mission defs, dilation `maxActiveSeconds` + smooth `scaleAt` +
drain-only-while-inside). The self-test now runs 12 checks and passes. The work
below therefore targets the **player-facing UX gaps** first, then a short
code/docs cleanup for the few caveat items that remain open.

Legend for source tags: `Pn` = PLAYTEST.md finding, `Cn` = caveat.md item.

---

## Phase 1 - Onboarding and first-run clarity  [P:A1,A2,A3,A4]

The biggest wall: a cold player is never told the controls, the launch, the
mission objectives, or that the two innovations exist.

- **A1** Attract-screen control strip (`SHIFT Flippers / SPACE Launch / ARROWS
  Nudge / P Pause`) plus a "keys rebindable in settings" line. Re-show the same
  strip along the bottom for the first few seconds of a new game.
- **A2** Actually draw the existing-but-unused `launchHint` over the lane while the
  ball rests there uncharged.
- **A3** Mission objective instruction line ("Hit the pop bumpers!", etc.) shown
  for the first few seconds of each mission, then collapsing to the counter.
- **A4** First-time callouts: a "SLO-MO READY" cue when the dilation meter first
  fills, and a prominent mode banner ("STATION" / "ASTEROID FIELD") when the table
  transforms, so both innovations are noticed and understood.

Risk: low (additive UI text/overlays; no sim changes, determinism untouched).
Verify: self-test all-OK; screenshots of attract, launch, mission, dilation-ready,
and a transform banner.

## Phase 2 - HUD layout and legibility  [P:B1,B2,B3,B4,B5]

- **B1** Fix the top-center collision of rank / multiplier / center-standup label.
  Reserve a clean HUD column; move or relabel the select-standup text so it never
  sits under the score.
- **B2** Make the Time-Dilation meter legible and tied to its zone (label, READY
  state, the zone ring as the primary meter).
- **B3** Promote the table-mode indicator to a legible top-corner badge that glows
  on change and dims afterward.
- **B4** Move the plunger charge readout onto the shaft / inside the lane instead of
  the off-playfield gutter.
- **B5** Relocate the "BALL SAVE" indicator off the flippers (a shrinking ring
  around the live ball plus a small HUD tag).

Risk: low/medium (HUD geometry only). Verify: self-test; screenshots of play with
multiplier, multiball, dilation, ballsave, asteroid.

## Phase 3 - Playfield readability and active-objective cues  [P:C1,C2,C4,E1]

- **C1** Make the mission-select standups larger and clearer (recognizable target
  look, stronger lit/unlit states).
- **C2** Add an animated "shoot here now" highlight (pulse + chevron) on whatever
  element the current mission wants.
- **C4** Give idle pop bumpers a more "live" resting look so they read as bumpers.
- **E1** Redundant, non-color encoding (shape/motion/outline) for every "active"
  element so state survives colorblind and reduced-motion modes.

Risk: medium (renderer changes; must stay reduced-motion and colorblind safe).
Verify: self-test; screenshots in default, colorblind, and reduced-motion.

## Phase 4 - Feedback and game feel  [P:D1,D3,F  C:#24]

- **D1** Stop double-notifying promotions (one banner, drop the duplicate popup).
- **D3** Add a speed-dependent component to the bumper kick so pops are not "samey"
  (caveat #24).
- **F** Nudge visual feedback (a brief, reduced-motion-gated table-shift), a simple
  message anchor so banners/popups never overlap, and minor attract polish.

Risk: low/medium (D3 touches collision response; re-verify tunnel/flipper tests).
Verify: self-test; before/after screenshots.

## Phase 5 - Table depth (design)  [P:C3,D2  C:#19,#20]

The largest, most design-heavy phase; may be split.

- Add inlanes/outlanes and at least one ramp or orbit so draining is earned and
  there is something to shoot for (caveat #19, ramps were specified but unused).
- Make Asteroid mode strategically distinct (not just a reshuffle) and the swap a
  clear event (caveat #20).

Risk: high (new geometry + tuning; physics must stay clean). Verify: self-test;
extended playtests; new geometry assertions.

## Phase 6 - Code and docs cleanup  [C:#1,#2,#21,#22,#23]

- **C#2** Route a small, seeded randomness through the existing PRNG (e.g. a tiny
  bumper-kick jitter) so `world.rng` is real and tested, or remove it.
- **C#1/#22/#23** Align the determinism / cross-browser claims with what is
  actually true now (deterministic trig is in), and note the test surface.
- **C#21** Make the loop's backlog-drop visible (a dropped-frame flag) rather than
  silent.
- Update `caveat.md` to mark resolved items and refresh `CHANGELOG.md`.

Risk: low. Verify: self-test; doc review.

---

## Progress log

- [x] Phase 1 - Onboarding and first-run clarity (self-test all-OK, determinism
  signature unchanged `d302b753`, no console errors; verified by screenshots
  `tools/shots/p1_*`). Added: attract + opening-seconds controls strip
  (`PB.Menus.drawControls`), the previously-dead `launchHint` now drawn over the
  lane, per-objective mission instructions, and rising-edge "SLO-MO READY" /
  table-transform callouts (`drawCallout`). All app/UI-layer only; the simulation
  was untouched.
- [ ] Phase 2 - HUD layout and legibility
- [ ] Phase 3 - Playfield readability and active-objective cues
- [ ] Phase 4 - Feedback and game feel
- [ ] Phase 5 - Table depth (design)
- [ ] Phase 6 - Code and docs cleanup
