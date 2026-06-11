# Changelog

All notable changes to this project are documented here, one entry per phase.
This project follows the phased build plan in `PLAN.md`. Post-v1 UX work follows
the remediation plan in `WORKFLOW.md` (fixing the `PLAYTEST.md` / `caveat.md`
findings).

## UX Phase 4 - Feedback and game feel

Cleaner notifications and a livelier bumper feel. The self-test stays all-OK; the
only physics change (D3) is a pure function of the ball's approach speed and does
not disturb any asserted check (the canned signature path never contacts a bumper).

### Changed
- A promotion now shows a single centered banner. The duplicate ball-anchored
  "PROMOTED" particle popup (a second notice in a different color/place for the
  same event) was removed.
- Pop bumpers now kick harder the faster the ball arrives: a component proportional
  to the approach speed is added to the base kick, capped, so a busy bumper nest
  escalates instead of feeling uniform (`cfg.bumpers.kickSpeedFactor`, `kickMax`).
  Verified numerically: a 1200 px/s pop returns 1324 px/s vs 924 under the old
  fixed kick. Deterministic (a pure function of the approach speed).
- A nudge now gives a small camera bump so it feels physical (alongside the ball
  jolt and the rising tilt meter). Gated behind reduced motion and only on a nudge
  that actually applies (not while tilted).

## UX Phase 3 - Playfield readability and active-objective cues

Makes the objective-of-the-moment and the scoring elements legible on the
playfield. Render-time only; the simulation is unchanged (self-test all-OK,
signature `d302b753`). Verified in default, colorblind, and reduced-motion modes.

### Added
- An animated "shoot here now" cue (a pulsing ring plus a bobbing chevron) that
  tracks whatever the current mission wants: the pop bumpers for Warp Survey, the
  still-up drop targets for Target Lock, the lit RESCUE standup for Rescue, and the
  START gate while a mission is selected (`drawObjectiveCues`). Under reduced motion
  the ring and chevron are steady but still drawn, so the cue is never color- or
  motion-only.
- Idle pop bumpers gained a breathing inner ring so a resting bumper reads as a
  live scoring bumper rather than a passive circle (steady under reduced motion).

### Changed
- Standup targets now render as clear physical targets: a backing plate, a bright
  mission-colored face with a white core and label when lit, and a steady,
  still-visible target when unlit (previously a faint dash). The white core is a
  redundant, non-color "armed" cue that survives the colorblind palette and reduced
  motion.

## UX Phase 2 - HUD layout and legibility

Fixes the crowded, partly-broken HUD. UI-layer only; the simulation is unchanged
(self-test all-OK, signature `d302b753`).

### Changed
- The rank and multiplier now share one measured, centered line under the score,
  and the playfield standup labels render below their bars, so the center label no
  longer collides with the rank/multiplier (the old top-center garble is gone).
- The time-dilation charge is read off the zone ring itself (which already fills
  with charge) plus a tethered "SLO-MO" / "SLO-MO READY" label under it; the small,
  far-left edge meter (disconnected from its zone) was removed.
- The table-mode indicator (Innovation 1) is now a legible top-right badge in the
  mode's accent color (cyan Station / amber Asteroid) with a status dot, instead of
  near-invisible dim text at the bottom.
- The plunger charge readout moved out of the off-playfield gutter into an in-lane
  track: the lane fills amber from the bottom while charging, with a green
  "skill shot" band near the top and tick marks for repeatable launch power.
- Ball save is now a shrinking ring around the live ball plus a small top-left tag,
  so it no longer draws over the flippers.

## UX Phase 1 - Onboarding and first-run clarity

First-run guidance so a cold player can actually learn the game. UI-layer only;
the deterministic simulation is unchanged (self-test all-OK, signature `d302b753`).

### Added
- A controls strip on the attract screen and along the bottom for the opening
  seconds of a new game (`PB.Menus.drawControls`): `SHIFT Flippers / SPACE Launch
  / ARROWS Nudge / P Pause`, with a "keys rebindable in settings" note.
- The launch prompt is now actually drawn: the previously-defined-but-unused
  `launchHint` shows over the plunger lane while the ball rests there uncharged.
- Mission objective instructions ("Hit the pop bumpers!", "Clear the drop-target
  bank!", "Hit the lit RESCUE target!") for the first few seconds of each mission,
  then collapsing to the compact counter.
- First-time innovation callouts (`drawCallout`): a "SLO-MO READY" cue when the
  time-dilation meter first fills, and a prominent "STATION" / "ASTEROID FIELD"
  banner when the table transforms, so both signature mechanics are noticed.

## Phase 7 - v1 polish and release (v1.0.0)

The accessibility and performance passes that make v1 shippable, plus the final
docs. This is the v1.0.0 release.

### Added
- Accessibility: a deuteranopia-friendly colorblind palette (`PB.palettes` +
  `PB.applyPalette`). cfg.theme is the live palette, and applyPalette copies the
  chosen set into it in place, so every draw call that reads cfg.theme switches
  with no extra plumbing; the colorblind set shifts the green and red roles to
  blue and orange while keeping cyan, amber, and magenta. Reduced motion now also
  suppresses screen shake (it already gated the starfield, particles, glow, and
  zone ripples). Menu selection already shows a highlighted focus row, and the
  flipper and plunger keys are rebindable.

### Changed
- Performance: the background radial gradient is built once and cached instead of
  being rebuilt every frame; particles were already pooled with no per-frame
  allocation in Phase 6. The fixed-timestep loop keeps the simulation stable and
  decoupled from the render rate.
- The slingshot color now comes from the active palette rather than a one-off
  colorblind branch in the renderer.
- Final `README.md` (controls, how to play, missions, multiball, the three
  innovations, accessibility, and the self-test).

### Cross-browser

Verified headless on Chrome under `file://` (self-test all-OK, no console
errors). The code is plain ES5-era JavaScript with a `webkitAudioContext`
fallback, classic script tags, Canvas 2D, localStorage, and
requestAnimationFrame only, so it is within the shared Chrome/Firefox/Safari
baseline; Firefox and Safari were not machine-tested in this environment.

### Exit criteria

Met for v1.0.0: a fresh clone opens `index.html` and plays a full game from title
to game over with persistent high scores, working menus, audio, the three
innovations, and the accessibility options, with no console errors on a `file://`
load. Self-test: `det=OK tunnel=OK flipper=OK ranks=OK store=OK balls=OK
missions=OK multiball=OK dilation=OK transform=OK`.

## Phase 6 - The three v1 innovations

This stops being a clone and becomes "Deluxe." All three signature innovations
are in, plus a polish pass (pooled particles, screen shake, score popups).

### Added
- Innovation 1, Dynamic Table Transformation (`js/game/transform.js`): the table
  reconfigures between Station and Asteroid Field modes. Completing a mission
  warps the table; the pop bumpers glide to a new formation and resize, and two
  deflector walls deploy by growing out from a point, all eased over a fixed
  duration. The morph is driven from the fixed-step update and every body
  position is a pure function of one progress value, so it stays deterministic
  and the swept collision keeps working against the moving bodies.
- Innovation 2, Time Dilation Zone (`js/game/timedilation.js`): a circular zone
  holds a charge meter that fills from bumper and slingshot hits. Once full,
  rolling a ball into the zone activates slow motion for that ball: its per-body
  `dtScale` drops so it integrates in slowed sim-time while the rest of the table
  runs at full speed. The meter drains while active. Scaling time (not velocity)
  in `PB.step` keeps energy intact, and the whole thing is a pure function of the
  charge, ball positions, and zone, so determinism holds. Animated ripple visual.
- Innovation 3, Layered Dynamic Music: finalized in Phase 5 and confirmed wired
  to game state (pad in menus, + bass in play, + drums on a mission, + lead on
  multiball).
- Polish: `js/engine/particles.js` (a pooled spark + score-popup system with no
  per-frame allocation), `js/engine/camera.js` (trauma-model screen shake driven
  by sine, never the sim PRNG), neon glow on the new elements, and easing score
  popups. Particle bursts and shake fire on hits, jackpots, multiball, rank-ups,
  and drains, and are gated behind the reduced-motion setting.
- `js/config.js` `transform` and `dilation` tuning blocks, with the zone and
  per-mode geometry in the table data (`js/tables/classic.js`).
- Self-test adds `dilation` (a primed ball entering the zone slows and drops its
  dtScale) and `transform` (toggling morphs bumper 0 to its Asteroid position and
  deploys a deflector, and toggling back restores Station exactly).

### Exit criteria

Met. All three innovations work and read clearly on screen (verified by a
playfield capture showing Asteroid mode with deployed deflectors, the active
dilation zone with ripples, and particle/popup feedback). The self-test reports
`det=OK ... dilation=OK transform=OK`, confirming the new physics stayed
deterministic, with no console errors on a normal `file://` load.

## Phase 5 - Audio

It now sounds like a deluxe arcade machine. Every key event has a synthesized
sound, and a layered music bed thickens during missions and multiball. There
are still no audio files: everything is generated at runtime with Web Audio, so
the repo stays clone-and-play.

### Added
- `js/engine/audio.js`: a Web Audio engine built from oscillators and noise
  buffers. The context is created lazily on the first user gesture (browser
  autoplay policy) and every method is a safe no-op until then, so the headless
  self-test is untouched. Routing is master -> destination with a music bus and
  an sfx bus underneath.
- Synthesized SFX for every key event: plunger launch, flipper, pop bumper,
  slingshot, drop/standup targets, bank clear, mission start, ball lock,
  multiball, jackpot, rank-up, ball saved, mission fail, drain, and tilt.
- Layered dynamic music: a four-bar minor progression with pad, bass, drums,
  and lead layers. A small lookahead scheduler (driven once per render frame)
  queues notes against the audio clock for glitch-free timing. Layer gains ramp
  with the intensity: pad in menus, + bass in play, + drums during a mission,
  + lead during multiball.
- A `g.audioEvents` cue queue: the game-rules and mission layers push sound cues
  (`PB.Game.cue`) that the app drains and plays. The queue never feeds back into
  the simulation, so physics stays deterministic. Flipper, plunger launch, and
  tilt sounds are driven from input/event edges in the app layer.
- `js/config.js` `audio` block (master ceiling, music/sfx bus levels, bpm, layer
  fade time). Settings volume and mute now drive the master gain live.

### Exit criteria

Met. Every key event has sound; the music intensifies during missions and
multiball; volume and mute work from the settings menu. The self-test still
reports `det=OK tunnel=OK flipper=OK ranks=OK store=OK balls=OK missions=OK
multiball=OK`, confirming the audio plumbing did not disturb the deterministic
simulation, with no console errors on a normal `file://` load.

## Phase 4 - Missions and multiball

Goal-driven play: select a mission with lit targets, start it, complete its
objective for a jackpot, and bank balls toward a basic 3-ball multiball.

### Added
- `js/game/missions.js`: the mission state machine (idle, selected, active) and
  the multiball lock sequence. Three v1 missions: Warp Survey (hit the pop
  bumpers a set number of times), Target Lock (clear the drop-target bank), and
  Rescue (hit the lit rescue target), each on a countdown that fails on timeout
  and pays a raw jackpot on completion.
- Standup targets in the table data (`js/tables/classic.js`) and builder
  (`js/game/table.js`): three selectors choose a mission, a START gate begins the
  selected one, and a LOCK target banks balls. Built as `kind: 'standup'`
  collision segments with a hit debounce so one strike emits one event.
- Basic 3-ball multiball: the third LOCK hit adds two more balls at fixed
  (deterministic) spawn states. The simulation now tracks every ball in
  `world.bodies`; a ball lost while others remain leaves play with no life lost,
  and only the final ball draining costs a life.
- `PB.sim.addBall` / `PB.sim.removeBall` and an all-balls contact, flipper, and
  drain pass in the step. The renderer draws every active ball and the standup
  targets (lit, with labels, when armed by the mission state).
- HUD mission line (selected mission, active objective progress, and countdown)
  and a multiball/lock indicator.
- Self-test (`index.html?selftest`) adds `missions` (select, start, complete for
  a jackpot, and timeout fail) and `multiball` (lock to start, then verify extra
  balls drain without losing a life and multiball ends).

### Changed
- `js/config.js`: new `missions` block (lock count, per-mission needs/timers/
  jackpots, deterministic extra-ball spawns), a `standups` physics block, and a
  `standup` score value. Version 0.4.0, phase 4.
- `js/main.js`: the simulation and game-rules layers route events through the
  mission state machine and tick its timers each step; `spawnBall` discards
  multiball balls so a new ball always starts alone.

### Exit criteria

Met. A player can select, start, and complete each of the three missions for
score, and multiball triggers from the lock sequence and resolves correctly back
to single-ball play. The self-test reports `det=OK tunnel=OK flipper=OK ranks=OK
store=OK balls=OK missions=OK multiball=OK`. No console errors, offline via
`file://`.

## Phase 3 - Table data, scoring, ranks, ball management

A complete basic game: start screen to game over, a real score with ranks,
three balls with ball save, persistent high scores, and working menus.

### Added
- `js/tables/classic.js`: the table as a plain data object (walls, arcs,
  slingshots, bumpers, drop bank, flipper specs, spawn, lane). Not fetched JSON.
- `js/game/table.js`: builds the physics world and element references from a
  table data object, replacing the inline geometry in main.js.
- `js/game/scoring.js`: score, multiplier, and the nine-step rank ladder (Cadet
  to Fleet Admiral) with promotion detection.
- `js/engine/storage.js`: versioned LocalStorage schema for high scores and
  settings, with migration and graceful fallback when storage is unavailable.
- `js/ui/hud.js`: in-play HUD (score, rank, ball count, multiplier, ball-save
  countdown, tilt meter, transient messages).
- `js/ui/menus.js`: canvas-drawn attract/title with high scores, pause menu,
  settings menu, and game over with arcade-style initials entry.
- A simulation/event layer (`PB.sim`) that emits gameplay events; a game-rules
  state machine (`PB.Game`) for score, ranks, three balls, ball save, and
  game over; and a screen state machine (attract, play, pause, settings, game
  over) in `js/main.js`.
- Settings: volume, mute, reduced motion (freezes the starfield and drops glow),
  colorblind palette, and rebindable flipper and plunger keys (with live capture).
- The self-test (`index.html?selftest`) now also checks the rank ladder, the
  high-score storage logic, and ball management driving the game to game over.

### Changed
- `js/engine/input.js` reads flipper and plunger bindings from saved settings,
  adds menu navigation edges and a key-capture mode for rebinding.
- `js/config.js` separates physics/gameplay tuning from geometry (now in the
  table data) and adds a game-rules section.

### Exit criteria

Met. A full game runs from the start screen to game over; the score persists to
high scores; ranks promote with on-screen notices; and the pause, settings, and
game-over menus work. The self-test reports
`det=OK tunnel=OK flipper=OK ranks=OK store=OK balls=OK`. No console errors,
offline via `file://`.

## Phase 2 - Flippers and the playfield

It now plays like pinball: launch, flip, hit bumpers and targets, drain. Flippers
feel responsive and tilt can lock you out.

### Added
- `js/game/flipper.js`: rotating flippers that slew between a rest and an active
  angle and impart their surface velocity to the ball on contact (the source of
  flipper "kick"). A swept solver handles the ball-into-flipper case; a dedicated
  overlap resolver handles the flipper-into-resting-ball case so a raised flipper
  launches the ball.
- `js/game/bumper.js`: pop bumpers (circular) with an outward kick, score, and a
  lit flash.
- `js/game/target.js`: a drop-target bank that knocks down for points, awards a
  bonus when cleared, and pops back up after a delay.
- `js/game/ramp.js`: helpers to build curved guides (arc) and channel lanes,
  used here to round the top corners so a launched ball orbits over the top.
- Nudge and tilt in `js/engine/input.js` and the step logic: arrows nudge the
  ball and fill a tilt-bob meter; crossing the limit triggers TILT, which
  disables the flippers and nudges until the ball drains.
- Flipper bindings (Shift keys, with Z and slash as alternates) alongside the
  Phase 1 plunger (Space or Down) and reset (R).

### Changed
- `js/physics/collision.js` now resolves moving surfaces (flipper surface
  velocity in the bounce frame), circular bumpers (swept circle test), per-hit
  kick impulses, and records per-step contacts for scoring. Ball speed is clamped
  for stability.
- `js/physics/physics.js` world gains `flippers` and `circles` collections and a
  speed clamp; segments carry kind/score/active metadata.
- A real inline table replaces the Phase 1 box: rounded top, plunger lane, three
  bumpers, two slingshots, a drop-target bank, two flippers, and angled lower
  walls feeding three drain paths (two outlanes plus the center).
- A running score is shown in the HUD (the full scoring and rank system is
  Phase 3).

### Exit criteria

Met. The self-test (`index.html?selftest`) reports `det=OK tunnel=OK flipper=OK`:
the simulation is deterministic, a fast ball does not tunnel, and a flipper
propels a resting ball strongly upward. No console errors, offline via `file://`.

## Phase 1 - Physics core

A ball now obeys gravity, bounces realistically off walls with no tunneling, and
can be launched from the plunger. This is a sandbox, not a game yet.

### Added
- `js/physics/physics.js`: vector helpers, a seeded deterministic PRNG
  (mulberry32), the world/body/segment constructors, and the per-step integrator
  (semi-implicit Euler plus continuous collision).
- `js/physics/collision.js`: swept circle vs line-segment collision with rounded
  end caps (a capsule cast), resolved earliest-contact-first so a fast ball
  cannot tunnel through thin walls. Bounce response uses per-surface restitution
  and friction, with a resting threshold so the ball settles instead of jittering.
- `js/engine/loop.js`: fixed-timestep accumulator (120 Hz sim) with render
  interpolation decoupled from the display refresh rate.
- `js/engine/input.js`: keyboard handling for the plunger (hold Space) and a
  manual ball reset (R), read once per fixed step.
- `js/game/plunger.js`: hold-to-charge, release-to-launch plunger that imparts an
  upward velocity to a ball resting in the launch lane. Charge accumulates per
  fixed step, so identical holds produce identical launches.
- `js/game/ball.js`: interpolated, faux-3D shaded ball rendering.
- A hardcoded Phase 1 table in `js/main.js` (outer shell, top-right deflector
  chamfer, plunger lane and divider, and angled bottom funnels to a center drain).
  This geometry is throwaway and moves into table data in Phase 3.
- A self-test mode: open `index.html?selftest` to run two checks and report on
  the canvas and in `document.title`:
  - determinism: the same scripted input replayed twice yields an identical ball
    path (sampled and compared);
  - anti-tunneling: a ball launched at 80000 px/s stays inside the outer walls.

### Tuning
- Centralized new physics and plunger constants in `js/config.js` (gravity,
  restitution, friction, resting threshold, CCD iteration cap, drain line,
  launch speeds, charge time).

### Exit criteria

Met. The ball launches from the plunger, deflects into the playfield, bounces
realistically, settles, and drains off the bottom. The self-test reports
`det=OK tunnel=OK`. No console errors, offline via `file://`.

## Phase 0 - Skeleton and feasibility

Foundation laid. The repository opens and renders, and the `file://` module
loading question is settled.

### Added
- Full repository directory structure from `PLAN.md` section 3, with stub files
  for every module so the script load order is fixed now and never changes.
- `index.html` with a fixed-resolution `<canvas>` and the locked script-loading
  strategy (ordered classic `<script>` tags, single `window.PB` namespace).
- `css/main.css` (stage layout, aspect-ratio-preserving canvas scaling, neon
  framing) and `css/ui.css` (overlay placeholders).
- `js/config.js` (centralized tuning constants), `js/ui/strings.js` (all
  user-facing text in one place), and `js/main.js` (render bootstrap).
- A live parallax starfield background and the neon "Hello, Cadet" title screen
  to prove the rendering pipeline works end to end.
- `README.md`, `LICENSE` (MIT), `.gitignore`, `CHANGELOG.md`, and `BACKLOG.md`
  (populated with the out-of-scope ideas fenced off from v1).

### Feasibility test result (file:// ES module loading)

Tested empirically with headless Chrome 2026 loading a page that imports a
sibling ES module via a relative path from the `file://` origin.

Result: BLOCKED. Chrome refuses cross-origin module requests from origin "null"
(the file:// origin), reporting that cross-origin requests are only supported
for http, https, data, and a few privileged schemes. Safari enforces the same
restriction; Firefox behavior is inconsistent across versions.

Because the project must be clone-and-play across all target browsers under
`file://`, ES modules are rejected.

Decision (locked): use ordered classic `<script>` tags with a single global
`window.PB` namespace. Table data is stored as JavaScript objects (registered on
`window.PB.TABLES`), never fetched as JSON, for the same `file://` reason.

### Exit criteria

Met. Opening `index.html` directly via `file://` shows the animated starfield
and title with no console errors, fully offline.
