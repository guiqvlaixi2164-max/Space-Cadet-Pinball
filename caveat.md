# caveat.md - A harsh audit of v1.0.0

A deliberately unsparing catalogue of defects in the `v1.0.0` build, with the
evidence for each, why it matters, and a concrete fix and method. Ordered roughly
by severity. Nothing here was fixed; this is the honest debt ledger.

Legend: **[C]** correctness/bug, **[F]** physics/feel, **[A]** accessibility,
**[P]** performance, **[Q]** code quality, **[D]** design depth, **[X]** claims
integrity.

---

## 1. The headline "determinism across machines" claim is false [X][C]

**Defect.** `PLAN.md` section 0.5 and the README advertise deterministic physics
"reproducible across machines" as the foundation for a future replay feature
(`PLAN.md` v3). The build cannot deliver this:

1. The flipper rebuilds its endpoints with `Math.cos`/`Math.sin` every step
   (`js/game/flipper.js:35-36`, `_recompute`), and the table arcs use the same
   (`js/game/ramp.js:17-18`). `Math.sin`/`cos`/`tan` are **not** specified to be
   correctly rounded in ECMAScript; different JS engines and OS math libraries
   return results that differ in the last bit. Those sub-ULP differences feed the
   collision solver and diverge over time. `Math.sqrt` is IEEE-correctly-rounded
   (the collision normal math is safe), but the trig is not.
2. The self-test `determinism()` (`js/main.js`, `PB.selfTest.determinism`) only
   runs `run() === run()` inside the **same** engine in the **same** session. It
   structurally cannot detect cross-engine divergence, so it gives false
   confidence.
3. Real-time play is **not** captured anywhere. The loop samples held input once
   per fixed step (`js/engine/loop.js:31-35`), but the number of steps per frame
   depends on wall-clock frame timing, and no input-per-step log is recorded.
   There is nothing to replay from.

**Why it matters.** The replay feature is sold as "already possible." It is not.
Worse, the claim is stated as fact in shipping docs.

**Fix / method.**
- Downgrade the claim: say "deterministic within a single engine/session given the
  same per-step input sequence." Do this in `PLAN.md`, `README.md`, and the
  Phase 0 CHANGELOG note.
- For real replay later: (a) record the per-step input vector into a ring buffer
  keyed by step index; (b) replace `Math.sin/cos` in the hot path with a fixed,
  vendored polynomial approximation (or precompute flipper endpoints at a fixed
  set of quantised angles) so the math is bit-identical everywhere; (c) seed and
  actually use the PRNG (see #2) for any randomness; (d) add a cross-engine golden
  test: commit a recorded input trace plus the expected state hash and assert in
  CI on Chrome **and** Firefox.

---

## 2. Dead determinism scaffolding: the PRNG is created but never used [Q][X]

**Defect.** `js/physics/physics.js:50` builds `world.rng = PB.makeRNG(seed)`. A
repo-wide search finds **zero** readers of `world.rng`. There is no gameplay
randomness at all (bumper kicks are fixed), so the seeded-PRNG story in the plan
is decorative.

**Why it matters.** It implies a reproducible-randomness guarantee that nothing
exercises, and it is misleading dead code.

**Fix / method.** Either delete `world.rng` and `PB.makeRNG` if no randomness is
planned, or actually route gameplay variety through it (e.g. a small random
component on bumper kick angle, multiball spawn jitter) so "determinism where
randomness exists" becomes a real, tested property. If kept, add a self-test that
asserts the same seed yields the same stream.

---

## 3. No ball-to-ball collision; multiball balls pass through each other [F][C]

**Defect.** `js/physics/collision.js` (`moveBody`) sweeps each ball against
`world.segments`, `world.flippers`, and `world.circles` only. It never tests a
ball against other dynamic bodies. During multiball, balls overlap and pass
straight through one another.

**Why it matters.** It looks and feels wrong; multiball is a marquee feature and
ghosting balls are immediately noticeable.

**Fix / method.** Add a swept circle-vs-circle pass between dynamic bodies. Reuse
`capToi` with `r = ballA.radius + ballB.radius`, run it inside the same
earliest-time-of-impact loop in `moveBody` (treat the other ball as a moving
target, or, cheaply, as static within the step for a first cut), and apply an
equal-and-opposite impulse split by mass (equal mass, so swap normal-velocity
components). Add a self-test: two balls launched at each other should separate,
not overlap.

---

## 4. Fast flippers can pass through the ball (no swept flipper-vs-ball) [F][C]

**Defect.** A flip slews at `flipSpeed: 26` rad/s (`js/config.js`), i.e. ~0.217
rad per 120 Hz step. At the 80 px flipper length the tip travels ~17 px/step,
roughly the ball's diameter (radius 9). The ball's own sweep treats the flipper as
a static segment at its current angle (`collision.js:108-113`), and the
"flipper sweeps into a resting ball" case is handled only by a **discrete**
overlap check at the flipper's new position (`js/game/flipper.js:54-96`,
`resolveOverlap`). If the tip jumps past the ball within one step, neither path
catches it.

**Why it matters.** "Flipper pass-through" is the single most felt physics bug in
a pinball game: a hard flip occasionally whiffs through the ball.

**Fix / method.** Sweep the flipper too: compute the ball's position relative to
the flipper segment at both the previous and current flipper angle and test the
swept wedge, or substep the flipper rotation (advance the flipper in 3-4
sub-rotations per physics step and run `resolveOverlap` after each). The substep
approach is the smallest change. Add a test that a ball resting on the flipper at
max `flipSpeed` always gains upward velocity (extend the existing `flipperKick`
test to the worst-case tip contact).

---

## 5. Asteroid mode parks a bumper on top of the drop-target bank [C][F]

**Defect.** In Asteroid Field mode, bumper 3's target position is `(490, 300)`
radius 19 (`js/tables/classic.js`, `transform.bumpers`). The drop-target bank sits
at `x: 472`, `ys: [300, 332, ...]` (`dropTargets`). The ball's capture radius
against that bumper is `9 + 19 = 28`, but the top drop target is only 18 px from
the bumper centre. A ball can essentially never reach the top drop target in
Asteroid mode without being ejected by the bumper, and can get trapped rattling
between them.

**Why it matters.** A mode the game advertises actively breaks reachability of a
scoring element. It was never caught because the self-test checks only that
bumper 0 reaches its position, not for geometry conflicts, and no playtest covered
"clear the bank while in Asteroid mode."

**Fix / method.** Move the alt position of bumper 3 left/down clear of the bank
(e.g. `(500, 250)` or further from `x=472`), or relocate the bank in Asteroid
mode as part of the morph. Add a build-time assertion that no bumper's
`(r + ballRadius)` disc intersects any active drop/standup segment in either mode.

---

## 6. Morphing bodies move into the ball with no resolution [F][C]

**Defect.** `PB.transform.update` writes new bumper positions and grows the
deflector walls straight onto the live collision bodies each step
(`js/game/transform.js:update`). Nothing handles a bumper or a deploying wall
moving **into** a stationary/slow ball (the analogue of the flipper's
`resolveOverlap` does not exist for these). The swept ball test only sees the
bumper's new position; `capToi` will eject an already-overlapping ball
(`collision.js:54-57`, `c < 0` branch), but with an abrupt, possibly large jolt,
and a ball pinned between a growing deflector and a wall can stick.

**Why it matters.** Random hard kicks or a stuck ball during the warp animation.

**Fix / method.** Give moving obstacles the same treatment as flippers: after the
morph step, run a depenetration pass for any ball overlapping a moved bumper or an
active deflector, pushing it out along the surface normal with the obstacle's
inter-frame surface velocity added. Alternatively, suppress collision on a body
while it is mid-morph and only re-enable it once settled (cheaper, slightly less
satisfying).

---

## 7. The game is keyboard-only: unplayable on touch devices [C][A][D]

**Defect.** Input is wired exclusively to `keydown`/`keyup`
(`js/engine/input.js:71-90`). The only `pointerdown` listener exists to unlock the
audio context (`js/main.js:901`), not to play. There are no on-screen flipper or
plunger controls and no touch handlers.

**Why it matters.** Phones and tablets are a huge share of casual browser play;
the game does nothing on them beyond rendering. It also means a desktop user with
no usable Shift keys (or a kiosk) cannot play at all.

**Fix / method.** Add pointer/touch zones: left half of the canvas = left flipper,
right half = right flipper, a press-and-hold zone over the plunger lane = plunger
charge/release, and an on-screen nudge control. Map `touchstart`/`touchend` (and
`pointerdown`/`pointerup`) to the same held-state flags the keyboard sets in
`input.js`. Respect `touch-action: none` in CSS to prevent scrolling. Gate behind
a coarse-pointer media query so desktop is unaffected.

---

## 8. Phase 7's "full key remapping" exit criterion is unmet [A][X]

**Defect.** Only `flipperLeft`, `flipperRight`, and `plunger` are rebindable
(settings items 4-6 in `handleSettings`, `js/main.js`). Nudge (arrows), pause
(Esc/P), and menu navigation are hardcoded. The Phase 7 plan item literally says
"full key remapping." Additionally, `KeyZ` and `Slash` are permanently wired as
alternate flippers (`js/engine/input.js:44-45,65-66`), so a rebind never fully
takes effect: Z/`/` keep flipping regardless of the user's chosen keys.

**Why it matters.** It is a stated exit criterion reported as met, and the
hardcoded alternates can surprise a remapper (a key they "removed" still acts).

**Fix / method.** Extend the keymap and the settings UI to cover nudge-left/right/
up and pause. Make the Z/`/` alternates a separate, toggleable "extra binding"
rather than always-on, or drop them once nudge is remappable. Persist all of it
through the existing `storage` schema (bump the schema version and migrate, see
#9).

---

## 9. The storage "migration" silently deletes saves on any schema bump [C]

**Defect.** `migrate` returns fresh defaults whenever `d.version !== VERSION`
(`js/engine/storage.js:25-32`). The moment the schema version is ever incremented
(which #8 and any future feature will force), **every existing high score and
setting is discarded**, not migrated. The name "migrate" is aspirational; it is
really "reset on mismatch."

**Why it matters.** First real schema change wipes player data. The self-test even
encodes this wrong behaviour as correct (`storage` test asserts a `version: 99`
blob becomes defaults).

**Fix / method.** Implement actual stepwise migration: keep per-version upgrade
functions (`v1->v2`, `v2->v3`, ...) and run them in sequence, preserving
`highScores`. Only fall back to defaults if the data is unparseable or fails
validation. Update the self-test to assert that a `v1` blob upgraded to `v2`
**keeps** its scores.

---

## 10. Time dilation pops discontinuously at the zone boundary [F]

**Defect.** A ball's `dtScale` flips between `1` and `slowScale` (0.34) based on a
hard centre-in-circle test (`js/game/timedilation.js`, `inZone` +
`preStep`). Crossing the boundary changes the integration rate in a single step,
so the ball visibly jerks (apparent velocity discontinuity) at the zone edge.

**Why it matters.** The marquee "slow-motion skill shot" reads as a glitch at the
rim instead of a smooth easing.

**Fix / method.** Ramp `dtScale` smoothly with distance: e.g.
`scale = lerp(slowScale, 1, smoothstep(edgeBand))` over a band just inside the
radius, or ease the active ball's scale toward target over a few steps rather than
snapping. Also consider only draining the meter while a ball is actually inside
(currently it drains regardless, wasting the charge if the ball exits, see #11).

---

## 11. Time-dilation meter wastes charge and is nearly invisible [D][A]

**Defect.** Once armed and triggered, the meter drains on a timer whether or not a
ball is in the zone (`timedilation.postStep`, the `d.active` branch). If the ball
leaves immediately, the whole charge is burned for almost no slow-mo. Separately,
the only feedback is a thin arc ring at the zone (`timedilation.draw`); there is no
HUD meter, so a new player will not understand what is charging or why time
occasionally slows.

**Fix / method.** Drain only while a ball is inside the zone (and maybe pause the
drain otherwise), and/or cap active duration explicitly. Add a labelled HUD meter
("DILATION") next to the score, and a one-time tutorial popup the first time it
arms. Move the tuning knobs (already in `cfg.dilation`) but add `maxActiveSeconds`.

---

## 12. The music scheduler has no catch-up clamp; it bursts after a stall [C][P]

**Defect.** `schedule()` advances `m.nextTime` while `m.nextTime < currentTime +
0.12` (`js/engine/audio.js`, `schedule`). It is called once per `render` frame. If
the tab is backgrounded or a long GC/stall happens, `requestAnimationFrame`
throttles, `currentTime` jumps far ahead, and the `while` loop schedules a large
backlog of notes whose times are now in the **past**, so the Web Audio engine
fires them all at once: an audible cluster/garble on refocus.

**Fix / method.** Clamp the scheduler: if `m.nextTime` is more than, say, 0.25 s
behind `currentTime`, fast-forward `m.step16` and reset `m.nextTime` to
`currentTime` without emitting the skipped notes. Also consider suspending the
`AudioContext` when the tab is hidden (`document.visibilitychange`) and resuming on
return, which both fixes the burst and saves CPU.

---

## 13. Music and SFX keep running (and oscillators keep firing) during pause and mute [P][D]

**Defect.** `render` always calls `PB.audio.tick(...)` (`js/main.js`), so the
music scheduler keeps spawning oscillators on the pause screen and game over.
Muting only sets the master gain to 0 (`audio.applyMaster`); the oscillators still
run and consume CPU. There is no voice cap, so a jackpot during multiball can spawn
many simultaneous nodes.

**Fix / method.** Pause the music bus (ramp `musicBus` to 0 and stop scheduling)
when `app.screen !== 'play'`. When muted, suspend the context or stop scheduling
rather than just zeroing gain. Add a simple voice cap / pooled oscillator budget
for SFX so worst-case bursts cannot runaway.

---

## 14. The colorblind palette is a pure hue swap with two blues that still collide [A]

**Defect.** The colorblind palette (`js/config.js`, `PB.palettes.colorblind`)
remaps the green role to `#5b8dff` (blue) and keeps cyan `#36e3ff`. For a
deuteranope these two blues are distinguished only by a narrow hue difference and
can still be confused, and they co-occur on the playfield (cyan LOCK vs the
blue-now select/drop elements). It is a flat hue remap with no redundant encoding
(shape, fill pattern, icon) for elements that are color-only (bumpers, slingshots,
drop targets). Standups have text labels (good), most other elements do not.

**Fix / method.** Choose a palette with larger luminance separation between the two
"blue" roles (e.g. make the green role a light yellow `#f4e36a` instead of blue),
and add redundant encoding: distinct shapes/outlines or small glyphs per element
type so colour is never the sole signal. Validate by simulating deuteranopia/
protanopia/tritanopia on a screenshot.

---

## 15. Reduced motion still flashes and pulses [A]

**Defect.** Reduced motion suppresses the starfield drift, shake, particles, and
zone ripples, but the bumper hit-flash (`js/game/bumper.js`, unconditional
`shadowBlur` pulse), the blinking "PRESS ENTER" and "JACKPOT" message flashes
(`blinkOn()` and the message alpha in `js/ui/hud.js`/`menus.js`), and the ball glow
are not gated. WCAG reduced-motion also covers flashing/strobing, not just travel.

**Fix / method.** Thread `app.reduced` into the bumper, HUD, and menu draws and
replace blink/flash with steady states (or much slower, gentler fades) when set.
Centralise a `PB.reducedMotion` flag so every module reads one source.

---

## 16. Continuous small-object allocation contradicts the "no GC spikes" claim [P][X]

**Defect.** `PB.Missions.defs()` rebuilds an array of three fresh objects from
config+strings on **every** call (`js/game/missions.js:30-37`). It is called from
`onEvent`, `select`, `startSelected`, `complete`, `standupColor`, and the HUD
(`missions.js:54,85,91,110,180`, `hud.js:79`), and `standupColor` runs **per
standup per frame** during render. That is dozens of throwaway objects per second.
Phase 7's CHANGELOG claims "no GC spikes." Vector math in `physics.js` (`PB.V.add`
etc.) and `collision.js` also allocate `{x,y}` objects per operation per step.

**Fix / method.** Build the mission defs once at `PB.Missions.create` time and
cache them on `g.missions` (they are static for a run). Have `standupColor`/HUD read
the cached array. For the physics hot path, convert `PB.V` helpers to write into
out-params or use scalar locals (the integrator already mostly uses scalars; the
remaining allocations are in collision response object literals). Then measure with
the devtools allocation profiler to substantiate the claim.

---

## 17. `main.js` is a 900-line grab-bag that violates the project's own file rules [Q]

**Defect.** `PLAN.md` section 4 mandates "single clear responsibility" files
"under roughly 400 lines." `js/main.js` is ~900 lines and contains: the entire
simulation layer `PB.sim`, the rules layer `PB.Game`, the whole self-test suite,
the app/input glue, the screen state machine, **and** all table/HUD-adjacent
rendering (`drawTable`, `drawStandup`, `drawBackground`, starfield). The simulation
(`PB.sim`) living in `main.js` rather than a physics/game module is especially
surprising.

**Why it matters.** Hard to navigate, hard to test in isolation, and it directly
breaks a rule the project sets for itself.

**Fix / method.** Split: move `PB.sim` into `js/game/sim.js`; move the self-test
into `js/selftest.js` (loaded only when needed); move table/background rendering
into `js/ui/render.js`. Keep `main.js` to boot + loop + screen state. Update the
ordered `<script>` tags accordingly (the load order is already explicit in
`index.html`).

---

## 18. The same helper is implemented three times [Q]

**Defect.** A thousands-separator formatter exists as `PB.format.commas`
(`js/ui/hud.js:9`), a local `commas` in `js/main.js:644`, and another local
`commas` in `js/game/missions.js:24`. Three copies, one of which (`hud`) is the
"public" one.

**Fix / method.** Keep `PB.format.commas` as the single source and delete the other
two, updating call sites. Put shared formatting in a tiny `js/util.js` loaded
early.

---

## 19. "Ramps" were specified but never built [D][Q]

**Defect.** Phase 2's plan calls for `game/ramp.js` lanes that "route the ball,"
and `PB.Ramp.lane` exists (`js/game/ramp.js:27-35`) but is **never called**. The
table uses only two corner `arc`s (`js/tables/classic.js`). There are no real
ramps, orbits, inlanes, or outlanes that route the ball anywhere. The playfield is
sparse: 3 bumpers, 4 drop targets, 2 slingshots, 5 standups, and bare walls.

**Why it matters.** A signature pinball pleasure (shooting a ramp, riding an orbit)
is absent, and a delivered-looking module is dead code.

**Fix / method.** Either remove `PB.Ramp.lane` if ramps are out of scope, or build
at least one ramp/orbit into `classic.js` and route it (one-way gates via
`active`-toggled segments, a habitrail that returns the ball to a flipper). Add a
left orbit and inlane/outlane pair to make draining feel earned.

---

## 20. Table transformation is shallow and under-discoverable [D]

**Defect.** Innovation 1 only fires on mission completion (`PB.Missions.complete`
-> `PB.transform.toggle`), so a player who never finishes a mission never sees it.
It then ping-pongs between modes with no player control, no on-screen indication of
which mode is active or what each mode is good for, and the two modes do not change
strategy meaningfully (bumpers relocate; two short deflectors appear). It is visual
novelty, not a mechanic.

**Fix / method.** Give the player agency (a dedicated "warp" target/lock to toggle),
show a clear mode banner and a brief "what changed" cue, and make the modes
strategically distinct (e.g. Asteroid mode opens a ramp or changes scoring) so the
choice matters. At minimum, surface the current mode in the HUD.

---

## 21. The loop drops simulation time under load (silent slow-motion) [F][P]

**Defect.** `js/engine/loop.js:31-36`: if a frame needs more than `maxSubSteps`
(8) physics steps, the accumulator is zeroed (`if (n === maxSub) acc = 0`),
discarding the backlog. On a slow device or after a hitch, the simulation silently
runs slower than real time rather than catching up.

**Why it matters.** Inconsistent ball speed on weaker hardware; physics tied to the
machine's ability to keep 8x120 Hz.

**Fix / method.** This is a deliberate "avoid the spiral of death" guard and is
defensible, but it should be visible: log/flag when frames are dropped, lower the
physics rate adaptively if it persists, and ensure tuning targets a rate
(e.g. 120 Hz) the slowest supported device can sustain. Document the trade-off.

---

## 22. Cross-browser support is asserted but only Chrome was ever run [X]

**Defect.** v1.0.0 was machine-verified only on headless Chrome (acknowledged in
the Phase 7 CHANGELOG, which is good), but the README's "How it is built" and the
broader framing still imply tri-browser support. Firefox and Safari were never
executed. Safari in particular has historically been strict about
`webkitAudioContext`, autoplay, and exponential gain ramps to zero.

**Fix / method.** Actually run it: Playwright/WebDriver against Firefox and
WebKit (Playwright bundles a WebKit build that runs on Windows/Linux) loading
`index.html?selftest` and asserting the all-OK string, plus a screenshot diff. Add
to CI. Only then state tri-browser support.

---

## 23. Testing is shallow and in-page only [Q][X]

**Defect.** The only automated checks are `PB.selfTest` (sim + rules) run inside
the page via `?selftest`. There is no coverage for input handling, the screen
state machine, menus, audio, rendering, the storage migration path, or the new
innovations' edge cases (boundary pop, geometry conflicts). No CI, no headless
runner committed, no assertion library.

**Fix / method.** Add a Node-based harness (jsdom or Playwright) that loads the
modules and runs assertions in CI on every push. Add targeted tests for: storage
migration preserving scores (#9), ball-ball separation (#3), worst-case flipper
contact (#4), geometry non-overlap in both table modes (#5), and dilation boundary
continuity (#10).

---

## 24. Smaller issues worth a sweep [Q][F][P]

- `resolveOverlap` is called for every body each step with no `active` check
  (`js/main.js`, the flipper-overlap loop), so drained/inactive balls are processed
  needlessly. Guard with `if (!bb.active) continue;`.
- `Space` doubles as plunger-hold and menu-confirm (`js/engine/input.js:46,50`).
  Harmless today (play screen ignores `e.enter`), but muddy; separate the bindings.
- The window losing focus only releases flippers (`input.js:88`); the loop keeps
  simulating, so a ball can drain while the user is away. Consider auto-pausing on
  `blur`/`visibilitychange`.
- `PB.particles.update`/`draw` iterate the full 280-slot pool every frame even when
  empty. Track an active count or a free list to skip dead slots.
- Layout constants (HUD y-positions, menu offsets) are hardcoded across
  `hud.js`/`menus.js` rather than in `config.js`, against the "tune from one file"
  intent.
- `drainY` is 912 vs a 900 px canvas; fine, but undocumented why 12 px of slack.
- Bumper kick is a fixed normal impulse regardless of incoming speed
  (`collision.js:164-165` + `cfg.bumpers.kick`), which can feel "samey"; consider a
  small speed-dependent component.

---

## Priority order for paying this down

1. **#7 touch input** (whole platforms cannot play) and **#9 save-wipe migration**
   (data loss) - ship-blockers for a real audience.
2. **#3 ball-ball**, **#4 flipper pass-through**, **#5 Asteroid geometry**,
   **#6 morph depenetration** - the feel/correctness bugs players hit directly.
3. **#1/#22/#23 honesty + testing** - stop over-claiming; add Firefox/WebKit CI and
   real coverage.
4. **#10/#11/#20 innovation depth**, **#12/#13 audio robustness**, **#14/#15
   accessibility** - make the "Deluxe" features actually deliver.
5. **#16/#17/#18/#19/#24 code health** - cache mission defs, split `main.js`,
   de-duplicate helpers, remove dead code.
