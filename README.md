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
protocol). The game is designed to run fully offline with no network access.

Tested on Chrome, Firefox, and Safari.

## Status

Early development. See `PLAN.md` for the full phased build plan and `CHANGELOG.md`
for what has shipped so far.

- Current phase: Phase 3 (table data, scoring, ranks, ball management) complete.
  The game is playable start to finish with menus and high scores.

## Controls

Defaults (flipper and plunger keys are rebindable in Settings):

- Left flipper: Left Shift (also Z)
- Right flipper: Right Shift (also /)
- Plunger: hold Space or Down, release to launch
- Nudge: arrow keys (too much nudging tilts the table)
- Pause: Esc or P
- Reset ball (debug): R
- Menus: arrow keys to navigate, Enter to confirm, Esc to go back

From the title screen press Enter to start, or Esc for Settings.

## How it is built

- Canvas 2D rendering with a faux-3D presentation (perspective, parallax
  starfield, neon glow). No 3D engine.
- Custom 2D physics with swept continuous collision detection to keep a fast
  ball from tunneling through thin walls.
- Fixed-timestep simulation for reproducible, deterministic behavior.
- Web Audio synthesized sound and music (no audio files).
- Table data stored as plain JavaScript objects (not fetched JSON), so the
  game works under the `file://` origin where `fetch()` of local files is blocked.
- Scripts are loaded as ordered classic `<script>` tags under a single
  `window.PB` namespace, because ES module imports are blocked under `file://`
  in Chrome and Safari (see `CHANGELOG.md`, Phase 0).

## Project layout

See `PLAN.md` section 3 for the full directory map. In short: `js/engine`
(loop, input, audio, storage, effects), `js/physics` (math and collision),
`js/game` (ball, flippers, bumpers, targets, scoring, missions, the two
innovations), `js/tables` (table data), `js/ui` (HUD and menus).

## License

MIT. See `LICENSE`.
