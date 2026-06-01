# Space Cadet Pinball: Deluxe Edition

An innovative, browser-based reimagining of classic 3D Space Cadet pinball.
Built with vanilla HTML5, CSS, and JavaScript. Rendered on Canvas 2D with a
custom deterministic physics engine. No build step, no dependencies, no server.

## Play it

```
git clone <this-repo>
```

Then open `index.html` in your browser. That is the whole setup.

You can double-click `index.html` to open it directly from disk (the `file://`
protocol). The game runs fully offline with no network access. Click the page or
press a key once so the browser lets the audio start (autoplay policy).

## Controls

Defaults (the flipper and plunger keys are rebindable in Settings):

- Left flipper: Left Shift (also Z)
- Right flipper: Right Shift (also /)
- Plunger: hold Space or Down, release to launch
- Nudge the table: arrow keys (too much nudging tilts the table and locks the
  flippers until the ball drains)
- Pause: Esc or P
- Menus: arrow keys to navigate, Enter to confirm, Esc to go back

From the title screen press Enter to start, or Esc for Settings.

## How to play

- Launch the ball with the plunger, then keep it alive with the flippers.
- A short ball-save timer at the start of each ball returns a quick drain.
- Hit pop bumpers, slingshots, drop targets, and standup targets to score. The
  multiplier climbs as you clear the drop-target bank.
- Climb the rank ladder from Cadet to Fleet Admiral as your score grows.

### Missions

Three lit standup targets across the top select a mission; hit the START gate to
begin it, then complete the objective before the timer runs out for a jackpot:

- Warp Survey: work the pop bumpers.
- Target Lock: clear the drop-target bank.
- Rescue: hit the lit rescue target.

### Multiball

Bank balls on the LOCK target. The third lock starts a 3-ball multiball. While
several balls are in play, losing one costs no life; only the last drain does.

## The three Deluxe innovations

1. Dynamic Table Transformation. Completing a mission warps the table between
   Station and Asteroid Field modes: the pop bumpers glide to a new formation and
   two deflector walls deploy. The change is animated and re-tunes the collision
   bodies as it morphs.
2. Time Dilation Zone. A circular zone in mid playfield charges as you work the
   bumpers and slingshots. Once it is full, rolling a ball through it triggers
   slow motion for that ball, for a skill-shot window. The meter drains while
   active.
3. Layered Dynamic Music. The synthesized score builds with the action: a pad in
   the menus, bass once you are in play, drums during a mission, and a lead layer
   during multiball.

## Accessibility

In Settings:

- Volume and a global mute.
- Reduced motion: stops the parallax starfield, screen shake, particle bursts,
  and zone ripples.
- Colorblind palette: a deuteranopia-friendly palette that shifts the green and
  red roles to blue and orange.
- Full rebinding of the flipper and plunger keys.

## How it is built

- Canvas 2D rendering with a faux-3D presentation (parallax starfield, neon
  glow). No 3D engine.
- Custom 2D physics with swept continuous collision detection to keep a fast ball
  from tunneling through thin walls.
- Fixed-timestep simulation (120 Hz) with interpolated rendering, for
  reproducible, deterministic behavior.
- Web Audio synthesized sound and music (no audio files).
- Table data stored as plain JavaScript objects (not fetched JSON), so the game
  works under the `file://` origin where `fetch()` of local files is blocked.
- Scripts are loaded as ordered classic `<script>` tags under a single
  `window.PB` namespace, because ES module imports are blocked under `file://` in
  Chrome and Safari (see `CHANGELOG.md`, Phase 0).

A built-in self-test runs the physics and game-rules layers headlessly: open
`index.html?selftest` and it reports determinism, no-tunneling, flipper kick,
ranks, storage, ball management, missions, multiball, time dilation, and table
transformation.

## Project layout

See `PLAN.md` section 3 for the full directory map. In short: `js/engine` (loop,
input, audio, storage, particles, camera), `js/physics` (math and collision),
`js/game` (ball, flippers, bumpers, targets, scoring, missions, and the two
table innovations), `js/tables` (table data), `js/ui` (HUD and menus).

## License

MIT. See `LICENSE`.
