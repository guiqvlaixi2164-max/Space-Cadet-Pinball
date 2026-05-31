# Space Cadet Pinball: Deluxe Edition — Build Plan

A build-ready specification for an innovative, browser-based reimagining of classic 3D Space Cadet pinball. This document is written for an autonomous coding agent (Claude Code). Follow it phase by phase. Do not skip ahead. Each phase ends with a working, committable, playable state.

---

## 0. Non-Negotiable Constraints

Read these first. They constrain every decision below.

1. **Clone-and-play.** The end user runs `git clone`, then opens `index.html`. Nothing else. No npm install, no build step, no bundler, no server required for the core game.
2. **The `file://` problem.** Opening `index.html` directly via `file://` blocks `fetch()` of local files in Chrome and most browsers (CORS policy on the `file://` origin). Therefore: **do NOT load table data with `fetch()` from JSON files.** Instead, store all table/level data as plain JavaScript objects/modules loaded via `<script>` tags (or `export`ed ES modules referenced with relative paths, which DO work under `file://` for same-directory modules in modern browsers — but test this early; if it fails, fall back to global `window.TABLES = {...}` script includes).
3. **Vendor everything.** No CDN runtime dependencies. If a library is used, the actual library file lives in the repo under `js/vendor/`.
4. **Tech baseline.** HTML5 + CSS + vanilla JavaScript. **Rendering: Canvas 2D.** (Rationale below in section 2.) No TypeScript, no JSX, no framework.
5. **Determinism where feasible.** The physics loop uses a fixed timestep so behavior is reproducible across machines and so a future replay feature is possible.
6. **No "—" character anywhere** in code comments, UI strings, docs, or commit messages. Use a regular hyphen or rephrase.
7. **Offline-first.** The game must fully function with no network connection.

---

## 1. Scope Definition

This project is delivered in **three phases (v1, v2, v3)**. Build v1 completely and make it genuinely fun before touching v2. The "wild experimental" ideas are explicitly out of scope for now and listed at the end as a backlog.

### In scope for v1 (the playable core)
A polished single-table pinball game that feels like classic Space Cadet plus three signature innovations.

- Working physics: plunger launch, two flippers, gravity, ball drain, ball save, tilt/nudge.
- One classic-style table: bumpers, drop targets, lanes, ramps, a plunger lane, two flippers.
- Scoring, multiplier, rank progression (Cadet through Admiral).
- Mission system with at least 3 missions selectable via lit targets.
- Multiball (basic, 3 balls).
- **Innovation 1: Dynamic Table Transformation** (table visually reconfigures between 2 modes: Station and Asteroid Field).
- **Innovation 2: Time Dilation Zone** (one area slows ball time; chargeable).
- **Innovation 3: Layered Dynamic Music** (synthesized via Web Audio; layers add on multiball/mission).
- Synthesized sound effects (Web Audio, no audio files).
- LocalStorage high scores and settings.
- Pause, game over, restart, settings menu (volume, key remap, reduced motion, colorblind palette).
- Particle effects, score popups, screen shake, neon glow.

### In scope for v2 (depth)
- Crew/RPG-lite progression (Engineer, Pilot, Scientist, Navigator with passive bonuses).
- Procedural mission events (Distress Signal, Pirate Attack, Wormhole Survey).
- Additional ball types (Plasma, Heavy Core).
- Wormhole teleporters (paired portals).
- Gravity-control power-ups.
- Space weather system (Solar Storm, Meteor Shower visuals + score effects).
- AI announcer via the browser SpeechSynthesis API (toggleable, off by default).
- Holographic center display showing mission/galaxy state.
- Second full table layout.

### In scope for v3 (spectacle and meta)
- Boss battles (1 boss: Alien Mothership with sequenced weak points).
- Galaxy exploration meta-game between runs (map, sectors modify next table).
- Table expansion layers / hidden sectors unlocked by milestones.
- Narrative campaign skeleton (chapter structure).
- Roguelite run-modifier mode.
- Replay highlights (relies on deterministic physics from v1).

### Explicitly OUT of scope (backlog, do not build yet)
Quantum probability multiball, time rewind/undo-drain, full Three.js 3D mode, physics-based destruction, alternate dimensions, infinite procedural universe, galactic civilization builder, pinball-on-pinball, planetary-orbit moving bumpers, the "Origin Signal" mega-table. These are recorded in `BACKLOG.md` for the future.

---

## 2. Key Architecture Decisions (locked)

These are decided. Do not relitigate them mid-build.

- **Canvas 2D, not 3D.** Pinball feel depends on precise, debuggable collision and snappy flippers, which are far easier in 2D. A faux-3D look (perspective skew on the table image, a specular highlight that tracks the ball, parallax starfield) gives "deluxe" polish without a 3D engine. The original game was 2D-with-art anyway.
- **Custom 2D physics, not a physics library.** Pinball needs continuous collision detection (the ball is fast and thin walls cause tunneling). A focused custom solver (circle vs line-segment, circle vs circle, swept collision) is more reliable and lighter than bending a general engine. Keep it in `js/physics.js`.
- **Fixed timestep accumulator** for the simulation (e.g. 120 Hz physics, render at display refresh). Rendering is decoupled and interpolated.
- **Table data as JS objects, not fetched JSON.** Tables live in `js/tables/*.js` as `window.PINBALL_TABLES.classic = {...}` (or ES module exports if `file://` module loading is verified working). This sidesteps the `fetch`-under-`file://` block.
- **Module loading.** Prefer ES modules (`<script type="module" src="js/main.js">`) with relative imports. **Verify in Phase 0 that relative ES module imports load under `file://` in the target browsers.** If any target browser blocks them, fall back to ordered classic `<script>` tags and a single `window.Game` namespace. Decide this in Phase 0 and stick with it.
- **No external fonts at runtime** unless the font file is vendored in `assets/fonts/` and loaded via `@font-face` with a relative path. A system font stack is the safe default.

---

## 3. Repository Structure

Create exactly this structure in Phase 0.

```
space-deluxe-pinball/
  index.html
  README.md
  LICENSE                      (MIT)
  PLAN.md                      (this file)
  BACKLOG.md                   (out-of-scope ideas parked for later)
  CHANGELOG.md
  .gitignore
  css/
    main.css
    ui.css
  js/
    main.js                    (entry point, game loop, state machine)
    engine/
      loop.js                  (fixed-timestep loop + interpolation)
      input.js                 (keyboard, remapping, nudge/tilt)
      audio.js                 (Web Audio: SFX synth + layered music)
      storage.js               (LocalStorage wrapper, versioned schema)
      particles.js             (particle system)
      camera.js                (screen shake, faux-3D skew helpers)
    physics/
      physics.js               (vectors, bodies, integrator)
      collision.js             (circle/segment, swept CCD, response)
    game/
      ball.js
      flipper.js
      bumper.js
      target.js                (drop targets, lit targets)
      ramp.js
      plunger.js
      table.js                 (loads a table def, builds bodies)
      scoring.js               (score, multiplier, ranks)
      missions.js              (mission state machine)
      transform.js             (dynamic table transformation: Innovation 1)
      timedilation.js          (Innovation 2)
    tables/
      classic.js               (v1 table definition as a JS object)
    ui/
      hud.js                   (score, rank, ball count, mission text)
      menus.js                 (start, pause, settings, game over)
    vendor/                    (any vendored libs; empty in v1 ideally)
  assets/
    fonts/                     (vendored font files if used)
    textures/                  (any sprite/texture PNGs; keep minimal)
    sounds/                    (only if synth proves insufficient)
```

If the `file://` ES-module test fails in Phase 0, flatten the module imports into ordered `<script>` includes in `index.html` but keep the same file paths.

---

## 4. Coding Standards

- Vanilla ES2020+. No transpilation.
- Each file is a single clear responsibility. Keep files under roughly 400 lines; split when larger.
- Pure functions in physics/collision where possible; side effects isolated to game objects.
- Comment the non-obvious math (collision response, dilation scaling), not the obvious.
- Config constants (gravity, flipper strength, ball radius) centralized in `js/config.js` so tuning is one file.
- No global mutable state except a single `Game` state object passed explicitly.
- Use `requestAnimationFrame` for rendering; never `setInterval` for the loop.
- All user-facing strings in one place (`js/ui/strings.js`) to ease future localization.
- No "—" anywhere. Lint comments and strings for it before each commit.

---

## 5. Phased Workflow

Each phase is a checkpoint. At the end of each, the game must run by opening `index.html`, and you must update `CHANGELOG.md` and commit. Do not start a phase before the previous one runs cleanly.

### Phase 0: Skeleton and feasibility (foundation)
**Goal:** Repo exists, opens, and the `file://` module question is settled.
- Create the full directory structure and empty/stub files from section 3.
- Write `index.html` with a `<canvas>` and the chosen script-loading method.
- **Run the `file://` ES-module feasibility test.** Document the result in `CHANGELOG.md`. Lock the loading strategy.
- Write `README.md` (how to clone and open), `LICENSE` (MIT), `.gitignore`, empty `CHANGELOG.md` and `BACKLOG.md` (populate backlog from section 1's out-of-scope list).
- Render a static colored canvas with a starfield background and a "Hello, Cadet" text to prove the pipeline works.
- **Exit criteria:** Opening `index.html` shows the starfield and text with no console errors, offline.

### Phase 1: Physics core
**Goal:** A ball obeys gravity, bounces off walls, and can be plunger-launched. No game yet.
- Implement `physics/physics.js` (vector math, body integration, fixed timestep via `engine/loop.js`).
- Implement `physics/collision.js`: circle vs line-segment with swept continuous collision detection (prevent tunneling), restitution, friction.
- Hardcode a simple boxed table with angled walls and a plunger lane.
- Implement `engine/input.js` with the plunger (hold to charge, release to launch).
- **Exit criteria:** A ball launches, bounces realistically, settles, drains off the bottom. No tunneling at high speed. Determinism verified (same input seed gives same path).

### Phase 2: Flippers and the playfield
**Goal:** It plays like pinball.
- Implement `game/flipper.js`: two flippers as rotating segments with angular velocity imparted to the ball on contact (this is what makes flippers feel good; tune carefully).
- Implement `game/bumper.js` (pop bumpers with impulse + score) and `game/target.js` (drop targets and lit targets).
- Implement `game/ramp.js` (guided lanes that route the ball).
- Implement nudge/tilt in `engine/input.js` with a tilt-bob meter and TILT lockout.
- Build the first real table geometry inline (will move to `tables/classic.js` next phase).
- **Exit criteria:** A full satisfying play loop: launch, flip, hit bumpers and targets, drain. Flippers feel responsive. Tilt works and can lock you out.

### Phase 3: Table data, scoring, ranks, ball management
**Goal:** A complete basic game with a score and lives.
- Move the table into `tables/classic.js` as a data object; `game/table.js` builds bodies from it.
- Implement `game/scoring.js`: points, multiplier, the rank ladder (Cadet, Ensign, Lieutenant, Captain, Lieutenant Commander, Commander, Commodore, Admiral, Fleet Admiral) with promotion events.
- Implement ball count (3 balls), ball save timer, game over.
- Implement `engine/storage.js` and persist high scores + settings (versioned schema).
- Implement `ui/hud.js` and `ui/menus.js` (start, pause, settings with volume/keys/reduced-motion/colorblind, game over).
- **Exit criteria:** A full game from start screen to game over, score persists, ranks promote, menus work.

### Phase 4: Missions and multiball
**Goal:** Goal-driven play, not just bumper-bashing.
- Implement `game/missions.js`: a mission state machine. Light targets to select a mission, hit a launch target to start it, complete objectives for a jackpot.
- Ship at least 3 v1 missions (e.g. Warp Survey: hit ramp sequence; Target Lock: clear drop-target bank; Rescue: hit lit target before timer).
- Implement basic 3-ball multiball triggered by a lock sequence.
- **Exit criteria:** Player can select, start, and complete missions for score; multiball triggers and resolves correctly.

### Phase 5: Audio
**Goal:** It sounds like a deluxe arcade machine.
- Implement `engine/audio.js`: Web Audio synthesized SFX (plunger, bumper pop, flipper, target, drain, rank-up, jackpot).
- Implement layered music: a base synth loop, with drum and lead layers that fade in during missions and multiball.
- Wire volume controls and a global mute to settings.
- **Exit criteria:** Every key event has sound; music intensifies during missions/multiball; volume and mute work.

### Phase 6: The three v1 innovations
**Goal:** This stops being a clone and becomes "Deluxe."
- **Innovation 1, Dynamic Table Transformation (`game/transform.js`):** Trigger a transition between Station mode and Asteroid Field mode. Panels slide, certain bumpers rise/lower, lanes shift. Animate the transition. Re-tune affected collision bodies on switch.
- **Innovation 2, Time Dilation Zone (`game/timedilation.js`):** A chargeable meter (fills by hitting blue targets). When active, a defined table region scales the simulation timestep for the ball inside it, creating slow-motion skill shots. Visual ripple effect on the zone.
- **Innovation 3, Layered Dynamic Music:** Already scaffolded in Phase 5; finalize the reactive layering tied to game state.
- Add `engine/particles.js` polish, `engine/camera.js` screen shake, neon glow, score-popup easing, parallax starfield.
- **Exit criteria:** All three innovations work and feel good; the game looks and sounds distinctly "deluxe."

### Phase 7: v1 polish and release
**Goal:** Shippable v1.
- Accessibility pass: colorblind-safe palette, reduced-motion mode, full key remapping, focus states on menus.
- Performance pass: stable frame rate; object pooling for particles; no GC spikes.
- Cross-browser test (Chrome, Firefox, Safari) opened via `file://`.
- Final `README.md` (controls, mechanics, screenshots), `CHANGELOG.md` entry, tag `v1.0.0`.
- **Exit criteria:** Clone the repo fresh, open `index.html`, play a full satisfying game with no console errors on all three browsers.

### Phases 8+ (v2 and v3)
Only begin after v1 is tagged and stable. Implement the v2 and v3 scope lists from section 1, one feature per branch, each with its own CHANGELOG entry and exit criteria. Keep the clone-and-play and no-build constraints intact throughout.

---

## 6. Definition of Done (per phase)

A phase is done only when ALL of these hold:
1. Opening `index.html` via `file://` runs the game with zero console errors, offline.
2. The phase's exit criteria are met and manually verified.
3. `CHANGELOG.md` has an entry describing what changed.
4. Config/tuning constants are in `js/config.js`, not scattered.
5. No "—" characters anywhere in the diff.
6. Code is committed with a clear message.

---

## 7. Risks and Mitigations

- **`file://` fetch/module blocking:** settled in Phase 0; tables are JS objects, not fetched JSON.
- **Ball tunneling through thin walls:** mandatory swept continuous collision detection in Phase 1; never use simple discrete overlap checks for the ball.
- **Flipper feel:** budget real tuning time in Phase 2; impart flipper angular velocity to the ball, do not treat flippers as static walls.
- **Scope creep:** the backlog is fenced off in `BACKLOG.md`; do not pull from it until v1 ships.
- **Performance from effects:** pool particles, cap counts, gate heavy glow behind the reduced-motion setting.
- **Audio autoplay policy:** browsers block audio until a user gesture; initialize the Web Audio context on the first key press or menu click.

---

## 8. First Action for the Coding Agent

Start with Phase 0 exactly as written: create the repo structure from section 3, settle the `file://` module-loading question, and get the starfield canvas rendering. Commit. Then proceed to Phase 1. Do not build features from later phases early.
