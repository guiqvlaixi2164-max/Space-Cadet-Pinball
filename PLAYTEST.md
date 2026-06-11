# PLAYTEST.md - A play-experience audit of v1.0.0

A hands-on, player-facing critique of the shipped game (`v1.0.0`, Phase 7). I read
the full source, ran the self-test (all 12 checks pass), and drove the real game
headlessly to render 17 actual frames of every screen and game state. Each finding
below is what a *player* sees and feels, with the on-screen evidence, why it hurts
the experience, a concrete fix, and the **ideal UI effect** to aim for.

This is deliberately separate from `caveat.md`, which audits code correctness and
physics. Where a player-facing symptom has a code root cause already logged there,
I cross-reference it but do not repeat the engineering detail.

**How this was produced.** `tools/playshot.html` loads the real game scripts and
freezes specific states; `tools/shots/*_shot.png` are the rendered captures cited
as evidence below. To reproduce: open `tools/playshot.html?s=<scenario>` in a
browser, or re-run the headless capture (`--headless=new` Chrome).

Severity legend: **[1]** breaks first-time play / blocks understanding,
**[2]** clearly degrades the experience, **[3]** polish.

Status of each finding is the shipped `v1.0.0`; nothing here is fixed yet.

---

## A. Onboarding and discoverability

### A1. There is no "how to play" anywhere; the player is never told the controls [1]

**Observation.** The attract screen (`attract_shot.png`) shows the title, high
scores, "Press ENTER to launch your career", and "ESC: settings". It never states
the controls. Once in play there is also no control reminder. A first-time player
does not know that **Shift = flippers**, **Space = plunger**, or **arrows = nudge**.
The only place keys appear at all is buried in the Settings rebind list
(`settings_shot.png`).

**Evidence.** `js/ui/menus.js:34-65` (`drawAttract`) draws only title, scores, and
the two prompts. `js/engine/input.js:10-13` defines the real bindings; nothing
surfaces them to the player.

**Why it matters.** This is the single biggest first-run wall. A player who opens
`index.html` cold can press ENTER, watch a ball sit in the lane, and have no idea
what to do next (see A2). Pinball's controls are not guessable on a keyboard.

**Fix.** Add a small, always-visible controls strip on the attract screen and a
one-line control reminder on the first ball of a new game.

**Ideal UI effect.** On attract, under "Press ENTER", a dim single row of pictographic
chips: `[Shift] Flippers   [Space] Launch   [< >] Nudge   [P] Pause`. The chips use
the same neon-on-dark style as the menu. On the very first ball of a fresh game,
fade the same strip in along the bottom for ~4 seconds, then fade out. Never show
it again that session (a `seenControls` flag in `storage`).

### A2. The launch prompt exists in code but is never drawn [1]

**Observation.** The string `launchHint: 'Hold SPACE to launch'` is defined but is
referenced by **zero** draw calls. On the first ball, the player sees a chrome ball
resting in the bottom-right lane (`launch_shot.png`) with no prompt to launch it.

**Evidence.** `js/ui/strings.js:56` defines it; a repo-wide search finds no render
of `launchHint` (only the definition). The plunger charge meter (`plunger_shot`
behaviour) only appears *after* you already hold Space, so it cannot teach the
action.

**Why it matters.** Combined with A1, the game can appear frozen on launch. The one
asset written to fix this (the string) was never wired up.

**Fix.** Draw `launchHint` centered over the plunger lane whenever the ball is in
the lane and the plunger has zero charge (`PB.sim.inLane` is already available in
`main.js`).

**Ideal UI effect.** A gentle amber pulse `Hold SPACE to launch` anchored just above
the resting ball in the lane, with a small downward chevron animation suggesting the
pull. It disappears the instant charge begins, so it never overlaps the launch.

### A3. Missions never explain their objective [1]

**Observation.** When a mission is active the HUD shows e.g. `WARP SURVEY 3/8 18s`
(`mission_shot.png`). It never says *what to hit*. Warp Survey wants bumper hits,
Target Lock wants the drop-target bank, Rescue wants the lit RESCUE standup, but the
player is given a name, a fraction, and a timer with no verb.

**Evidence.** `js/ui/hud.js:79-83` renders `name + progress + timer`. The objective
type (`d.objective`) is known right there but not surfaced as text. Mission start
(`missions.js:98`) only sets `name + ' START'`.

**Why it matters.** A goal-driven layer the game is proud of reads as an unexplained
counter. Players will complete missions by accident, not intent.

**Fix.** Map each objective to a short instruction string and show it for the first
~3 seconds of the mission, then collapse to the compact counter.

**Ideal UI effect.** On mission start, a two-line banner: line 1 the mission name in
amber, line 2 the instruction in cyan ("Hit the pop bumpers!", "Clear the drop bank!",
"Hit the lit RESCUE target!"). After 3s it shrinks to the existing `name 3/8 18s`
line. The element(s) the mission wants should also pulse on the playfield (see C2).

### A4. The two signature innovations are never taught [1]

**Observation.** Time Dilation: a dim ring sits mid-playfield (`select_shot.png`,
`dilation_charge_shot.png`); a thin "SLO-MO" meter sits top-left (`hud.js:113-128`).
Nothing tells the player that hitting bumpers/slingshots charges it, or that rolling
through it when full triggers slow motion. Table Transformation: the layout silently
swaps to Asteroid mode on mission completion (`asteroid_shot.png`) with only a tiny
dim "STATION"/"ASTEROID FIELD" word at the very bottom (`hud.js:133-143`).

**Evidence.** Charge logic `js/game/timedilation.js:91-97`; transform trigger
`js/game/missions.js:114-116`. No tutorial, callout, or first-time popup exists for
either. (Transform depth is also logged as `caveat.md` #20; this entry is about the
player never *learning* it exists.)

**Why it matters.** These are the features that make the game "Deluxe". If the player
cannot tell what the ring does or notice the table changed, the marquee mechanics are
invisible.

**Fix.** A one-time, dismissible callout the first time each innovation becomes
relevant, plus stronger persistent signposting (see B2 and C3).

**Ideal UI effect.** First time the dilation meter fills: a brief tooltip pointing at
the ring, "SLO-MO READY - roll the ball through the zone". First transform: freeze a
beat, flash a centered banner "ASTEROID FIELD" with a short sub-line "Layout changed",
and a quick screen-wipe so the change is unmissable.

---

## B. HUD layout and legibility

### B1. The top-center HUD collides with the center standup label [1]

**Observation.** At the horizontal center, three things stack into the same ~20px
band: the rank name, the multiplier badge, and the **TARGET** standup's text label.
In `mission_shot.png`, `multiball_shot.png`, and `play_shot.png` you can see "Cadet",
"x3"/"x4", and the center target's label mashed into an unreadable garble directly
under the score.

**Evidence (exact coordinates).**
- Rank name: `hud.js:28` draws at `(w/2, 78)`.
- Multiplier badge: `hud.js:34` draws at `(w/2, 96)`.
- Center standup "TARGET": its geometry is `a:[286,92] b:[314,92]`
  (`tables/classic.js:57`); the label renders at `min(a.y,b.y) - 8 = 84`, centered
  at `x=300` (`main.js:424`). That lands between the rank (78) and multiplier (96),
  on the same x.

**Why it matters.** The score area is the most-read part of the screen, and it is
visibly broken whenever a multiplier is active (which is most of the game).

**Fix.** Two independent moves: (a) move the three mission *select* standups off the
dead-center top so their labels never sit under the score column; or draw their
labels below the bar instead of above. (b) Give the HUD a reserved, non-overlapping
layout: score row, then a single combined "RANK . xN" row with fixed spacing.

**Ideal UI effect.** A compact top bar: large score centered; immediately under it a
single line "ENSIGN  -  x3" where the multiplier is a colored pill that animates a
quick scale-pop when it increments. Playfield target labels live entirely below
`y=110` so they never share space with HUD text.

### B2. The Time-Dilation meter is tiny, unlabeled in practice, and far from its zone [2]

**Observation.** The charge meter is an 8px-wide bar at the far left edge with a 10px
"SLO-MO" caption (`hud.js:113-128`). The zone it controls is a ring in the
lower-center of the playfield. The bar and the ring are on opposite sides of the
screen, with no visual link, and the bar is easy to miss entirely.

**Evidence.** Meter at `x=14, y=120, h=150` (`hud.js:115`); zone at `(250,470) r=64`
(`tables/classic.js:73`). In `dilation_charge_shot.png` the half-filled bar is barely
noticeable.

**Why it matters.** The player cannot build intuition that bumper hits feed this
meter, because the cause (bumpers, center) and the effect readout (far-left sliver)
are disconnected and the readout is small.

**Fix.** Make the *zone itself* the primary meter (its charge arc already exists,
`timedilation.js:128-136`) and either drop the edge bar or make it a clearly-labeled,
wider, color-coded meter that flashes "READY" when full.

**Ideal UI effect.** The ring fills clockwise as it charges (already there) but with a
bold rim and a floating "SLO-MO" label tethered to the ring. On full, the ring pulses
cyan and prints "READY" once; when active, the existing ripples plus a faint vignette
desaturating the rest of the table to sell the slow-motion.

### B3. The table-mode indicator is nearly invisible [2]

**Observation.** The current layout name renders as 11px text at 50% alpha at the
very bottom of the screen (`hud.js:133-143`, `y=884`). In every gameplay shot it is
an unreadable smudge ("STATION"/"ASTEROID FIELD").

**Why it matters.** It is the only persistent signal of which of the two layouts is
active (Innovation 1), yet it is the least legible element on screen.

**Fix.** Promote it to a readable, iconified badge in a top corner, and only dim it
*after* a transform has been seen.

**Ideal UI effect.** A small pill top-right: a station icon or asteroid icon plus the
word, in the mode's accent color (blue for Station, amber for Asteroid). On a mode
change it briefly enlarges and glows, then settles back to a quiet persistent badge.

### B4. The plunger charge meter is drawn outside the playfield, against the canvas edge [3]

**Observation.** The charge meter is positioned at `x = laneX + laneW + 6 = 572`
(`plunger.js:66-74`), but the right wall is at `x=566` and the canvas ends at 600.
So the meter sits in the 34px gutter beyond the wall, cramped at the very edge
(`launch_shot.png`, bottom-right).

**Why it matters.** Launch power is a real skill input (skill shot), and its only
readout is shoved off the play area where it is hard to watch while aiming.

**Fix.** Move the charge readout inside the lane or render it as a fill on the plunger
shaft itself.

**Ideal UI effect.** The plunger shaft fills amber from the bottom as you charge, with
3-4 tick marks and a brighter "skill shot" band near the top, so the player aims power
by watching the lane, not the gutter.

### B5. "BALL SAVE" text sits on top of the flippers [3]

**Observation.** The ball-save banner and bar render at `y=820`/`838`
(`hud.js:57-61`), directly over the flipper pivots (`pivotY: 800`,
`tables/classic.js:66-67`). See `ballsave_shot.png`: the label overlaps the action
zone exactly when the player is focused there.

**Fix.** Anchor the ball-save indicator near the score/HUD cluster, not the flippers,
or as a ring countdown around the ball.

**Ideal UI effect.** A thin shrinking ring drawn around the live ball during the save
window, plus a small "SAVE" tag in the HUD, so the timer is where the player's eye
already is (on the ball) and never occludes the flippers.

---

## C. Playfield readability

### C1. The mission-select standups are tiny bars hidden at the very top edge [2]

**Observation.** The three select targets (WARP / TARGET / RESCUE) are ~28px
horizontal bars pinned at `y=92-100`, right against the top wall
(`tables/classic.js:55-58`). In `select_shot.png` they read as faint dashes, not
"targets you shoot to choose a mission". They are also extremely hard to actually hit
up there.

**Why it matters.** Mission selection is the entry point to the whole goal layer, and
its controls are the least prominent, least reachable objects on the table.

**Fix.** Make them larger, give them a clearer lit/unlit state with a recognizable
target shape, and consider relocating them somewhere a flipped ball can plausibly
reach repeatedly.

**Ideal UI effect.** Three rounded "lane" targets with an icon per mission, glowing
green when selectable, pulsing amber when chosen, and showing a quick "SELECTED"
stamp on hit. A small arrow from the HUD mission line points to them while idle.

### C2. Lit vs unlit targets do not read as "shoot here now" [2]

**Observation.** Standups dim to `rgba(120,140,180,0.35)` when inactive and take a
mission color when active (`main.js:406-427`, `missions.js:173-188`). The active state
is a color change only, with a small text label. There is no motion, arrow, or
pulsing to draw the eye to the *current* objective target. During Rescue, only the
RESCUE standup is live, but nothing makes that obvious.

**Why it matters.** Players track motion far better than static hue. A purely
color-coded "hit this" cue is easy to miss mid-rally, and is exactly the case
`caveat.md` #14 (colorblind) also flags.

**Fix.** Add a redundant, animated "active objective" highlight: pulse, ring, or a
bouncing arrow on whatever element the current mission wants.

**Ideal UI effect.** The active objective target gets a slow breathing glow plus a
small chevron that bobs toward it; when hit it flashes white and emits a spark burst
(the particle system already exists). Colorblind mode keeps the shape/motion cues so
color is never the only signal.

### C3. The Asteroid transform changes too little to feel like a new table [2]

**Observation.** Comparing `play_shot.png`/`select_shot.png` (Station) to
`asteroid_shot.png` (Asteroid): three bumpers slide a little and resize, and two
amber deflector bars appear mid-field. The walls, flippers, lanes, targets, drain,
and scoring are identical. Strategically the two modes play almost the same.

**Why it matters.** "Dynamic Table Transformation" is a headline feature; right now it
is a cosmetic reshuffle the player may not even notice (B3 makes it worse). This is the
player-facing half of `caveat.md` #20.

**Fix.** Make the modes strategically distinct (Asteroid could open a ramp/orbit,
change which targets are live, or shift scoring) and make the swap a clear event.

**Ideal UI effect.** On transform, a short cinematic: table elements slide with motion
trails, a mode banner sweeps across, the accent palette shifts (cool blue Station vs
warm amber Asteroid), and a one-line "what changed" hint appears ("Asteroid Field:
deflectors active, bumpers worth 2x").

### C4. Pop bumpers do not read as bumpers until hit [3]

**Observation.** Idle bumpers are dim blue rings with a muted cap (`bumper.js:34-61`),
visually similar to the dilation ring and the faint arcs. They only become obviously
"bumpers" when they flash amber on contact. In `play_shot.png` a newcomer cannot tell
the three blue discs are the high-action scoring objects.

**Fix.** Give idle bumpers a more distinct, inviting resting look (subtle idle pulse,
a clear cap highlight, a faint star/asteroid motif fitting the theme).

**Ideal UI effect.** A slow idle shimmer on the cap and a thin animated energy ring, so
bumpers look "live" at rest and clearly different from passive rings/arcs; the existing
amber hit-flash then reads as a satisfying pop rather than the only time they look real.

---

## D. Feedback and game feel

### D1. A promotion fires two overlapping notices at once [2]

**Observation.** In `play_shot.png` (a rank-up moment) the screen shows a small green
"PROMOTED" particle popup near the ball *and* a large amber "PROMOTED: Ensign" message
banner mid-screen, simultaneously. They duplicate the same event in two styles and two
places.

**Evidence.** The banner: `PB.Game.setMessage(g, S.promoted + promo)`
(`main.js:259`) drawn at `(w/2, 470)` (`hud.js:96-104`). The popup:
`PB.particles.popup(..., S.promoted.replace(': ', ''), ...)` (`main.js:506-507`) at
the ball. Both are triggered off the same `rankup` cue.

**Why it matters.** Double-notifying the same thing in conflicting colors looks like a
bug and clutters the moment a promotion should feel clean and rewarding.

**Fix.** Pick one channel for promotions. Keep the centered banner (it carries the rank
name) and drop the redundant particle popup, or vice-versa, but not both.

**Ideal UI effect.** A single celebratory banner: rank name scales up with a brief
glow and a star-burst behind it, one sound, one place. Reserve the small ball-anchored
popups for point gains (jackpot/bank), not rank.

### D2. The center drain gap is wide and there are no inlane/outlane stakes [2]

**Observation.** The flippers pivot at `x=195` and `x=365` (`tables/classic.js:66-67`)
with an open gap between their tips and a long bare diagonal on the right
(`right lower wall`). There are no inlanes/outlanes, no center post, and no ramps or
orbits to aim for. Draining feels random rather than earned, and there is nothing to
*shoot* for between targets. (This is the play-feel face of `caveat.md` #19 - ramps
were specified but never built.)

**Why it matters.** The core pinball pleasures - cradle, aim a ramp, ride an orbit,
sweat the outlane - are largely absent, so rallies feel like undirected bouncing.

**Fix.** Add at least one ramp/orbit and an inlane/outlane pair; tune the flipper gap.
This is a design task, but it is what most separates "bouncing ball" from "pinball".

**Ideal UI effect.** A lit ramp entrance with an animated "shoot here" arrow that lights
when a mission wants it; an orbit that streaks the ball with a speed trail and awards a
combo if chained; outlanes with a tense red glow so a near-drain reads as drama.

### D3. Bumper kicks are a fixed impulse regardless of incoming speed [3]

**Observation / cross-ref.** Bumpers apply a constant `kick: 420` (`config.js:46`,
applied in `collision.js`), so every pop feels identical no matter how hard the ball
arrived. Logged as `caveat.md` #24; calling it out here because it is *felt*: bumper
clusters lack the escalating, chaotic energy players expect.

**Ideal UI effect.** Scale a small part of the kick and the visual flash/shake with
impact speed, so fast entries into the bumper nest produce a visibly and audibly
livelier pop.

---

## E. Cross-cutting accessibility and comfort

### E1. Color is often the only signal [2]

Lit/active state for standups, slingshots, the dilation ring, and bumpers is conveyed
primarily by hue (see C2). Even with the Okabe-Ito colorblind palette
(`config.js:162-166`), motion- or shape-based redundancy is missing for these elements.
**Ideal:** every "active now" element should also pulse, gain an outline, or show a
glyph, so the state survives any color-vision profile (and reduced-motion users get a
steady high-contrast outline instead of a pulse). Related: `caveat.md` #14, #15.

### E2. No control hint reaches a player who cannot use the default keys [2]

Because controls are never shown (A1) and only flippers/plunger/nudge/pause are
rebindable from a menu the player has to *find*, someone whose keyboard lacks usable
Shift keys can be stuck. **Ideal:** the attract control strip (A1) doubles as the
hint that controls are remappable ("ESC: settings / rebind keys").

---

## F. Smaller polish notes

- **Attract "ESC: settings" is the only hint and is easy to miss** (`menus.js:64`,
  62% alpha, 13px). Worth pairing with the control strip from A1.
- **Score/rank have no idle attract demo.** The attract screen is static; a slow
  auto-played demo ball or a parallax of the table would sell the game better.
- **Pause/Settings footers sit over the flipper area** (`pause_shot.png`,
  "ESC or P to resume" at the flippers). Minor, but it overlaps live-looking elements.
- **The dilation ring and the faint corner arcs and idle bumpers share a similar dim
  blue ring look**, making the mid-field read busy and ambiguous (ties to B2/C4).
- **`messageSeconds` banners and particle popups can stack** (D1 is the worst case);
  a tiny message queue/anchor system would prevent overlaps generally.
- **Nudge has no visual feedback beyond ball motion**; a brief table-shift/parallax
  kick on nudge (gated by reduced-motion) would make tilt risk legible.

---

## Priority order for the player experience

1. **A1, A2, A3, A4** - a first-time player currently cannot learn the controls, the
   launch, the missions, or the innovations. Onboarding is the top fix.
2. **B1** - the score area is visibly broken whenever a multiplier is active.
3. **C1, C2, B2, B3** - make the objective-of-the-moment and the two innovations
   legible on the playfield and in the HUD.
4. **C3, D2** - give the transform and the table layout real, felt stakes (design).
5. **B4, B5, D1, C4, E1/E2, F** - polish and accessibility redundancy.

## Screenshot index (evidence)

All under `tools/shots/`, rendered from `tools/playshot.html?s=<name>`:
`attract`, `launch`, `play`, `mission`, `select`, `multiball`, `dilation`,
`dilation_charge`, `tilt`, `careful`, `ballsave`, `asteroid`, `message`,
`gameover`, `gameover_entry`, `pause`, `settings`.
