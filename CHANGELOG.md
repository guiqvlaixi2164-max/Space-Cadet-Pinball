# Changelog

All notable changes to this project are documented here, one entry per phase.
This project follows the phased build plan in `PLAN.md`.

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
