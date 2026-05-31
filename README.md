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

- Current phase: Phase 0 (skeleton and feasibility) complete.

## Controls

Controls are added in later phases. They will be listed here and remappable
in the in-game settings menu. (Planned defaults: left/right arrows or Shift
keys for flippers, Space or Down arrow for the plunger.)

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
