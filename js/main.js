// main.js - entry point, the simulation/event layer (PB.sim), the game-rules
// state machine (PB.Game: balls, ball save, scoring, ranks), the screen state
// machine (attract / play / pause / settings / game over), rendering, and the
// self-test. Phase 3 makes this a complete basic game: start screen to game over,
// persistent high scores, promotions, and working menus.

(function (PB) {
  'use strict';

  var cfg = PB.config;
  var S = PB.strings;

  // ===========================================================================
  // Simulation layer: physics world + table elements. Emits gameplay events;
  // it does NOT keep score or manage lives (that is PB.Game). Deterministic.
  // ===========================================================================

  PB.sim = {
    create: function (tableDef) {
      tableDef = tableDef || PB.TABLES.classic;
      var sim = {
        world: PB.makeWorld(),
        ball: null, bank: null, left: null, right: null,
        spawn: null, lane: null,
        tilt: { bob: 0, tilted: false },
        plunger: PB.Plunger.create(),
        events: [],
        lastLaunch: 0,
      };
      sim.ball = PB.makeBall(tableDef.spawn.x, tableDef.spawn.y, cfg.physics.ballRadius);
      sim.world.bodies.push(sim.ball);
      PB.Table.build(sim, tableDef);
      return sim;
    },

    spawnBall: function (sim) {
      var b = sim.ball;
      // Discard any extra (multiball) balls; only the primary ball returns.
      sim.world.bodies.length = 0;
      sim.world.bodies.push(b);
      b.pos.x = sim.spawn.x; b.pos.y = sim.spawn.y;
      b.prev.x = sim.spawn.x; b.prev.y = sim.spawn.y;
      b.vel.x = 0; b.vel.y = 0;
      b.active = true;
      sim.tilt.tilted = false;
      sim.tilt.bob = 0;
    },

    // Add an extra ball in play (multiball). prev is back-set from the velocity
    // so the first swept step is consistent. Returns the new ball.
    addBall: function (sim, x, y, vx, vy) {
      var b = PB.makeBall(x, y, cfg.physics.ballRadius);
      b.vel.x = vx; b.vel.y = vy;
      b.prev.x = x - vx / cfg.sim.hz; b.prev.y = y - vy / cfg.sim.hz;
      sim.world.bodies.push(b);
      return b;
    },

    // Remove a (drained) ball from play. Keeps sim.ball pointing at a live ball.
    removeBall: function (sim, b) {
      var arr = sim.world.bodies, k = arr.indexOf(b);
      if (k >= 0) arr.splice(k, 1);
      if (sim.ball === b) sim.ball = arr[0];
    },

    inLane: function (sim) {
      var b = sim.ball;
      return b.pos.x > cfg.plunger.laneXMin && b.pos.y > cfg.plunger.laneYMin;
    },

    step: function (sim, input, dt) {
      var world = sim.world, ball = sim.ball, tilt = sim.tilt, tc = cfg.tilt;
      sim.events.length = 0;

      if (tilt.bob > 0) { tilt.bob -= tc.bobDecay * dt; if (tilt.bob < 0) tilt.bob = 0; }
      if (!tilt.tilted) {
        if (input.nudgeL) { ball.vel.x -= tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (input.nudgeR) { ball.vel.x += tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (input.nudgeU) { ball.vel.y -= tc.nudgeImpulse; tilt.bob += tc.nudgeBob; }
        if (tilt.bob >= tc.tiltAt) tilt.tilted = true;
      }

      var launched = PB.Plunger.update(sim.plunger, ball, !!input.plungerHeld, dt);
      if (launched) { sim.lastLaunch = launched; sim.events.push({ type: 'launch' }); }

      PB.Flipper.update(sim.left, !!input.flipperLeft && !tilt.tilted, dt);
      PB.Flipper.update(sim.right, !!input.flipperRight && !tilt.tilted, dt);

      // Innovations advance the world for this step before integration: the
      // table transformation repositions bodies, and time dilation stamps each
      // ball's dtScale (and may emit a 'dilate' event on activation).
      PB.transform.update(sim, dt);
      PB.timedilation.preStep(sim);

      PB.step(world, dt);

      // Ball-to-ball separation (multiball) before flipper handling.
      PB.resolveBallPairs(world);
      // Push balls out of bodies the morph moved into them (only while morphing).
      if (PB.transform.morphing(sim)) PB.transform.depenetrate(sim);

      var bodies = world.bodies, c, i, bi, bb;
      var fsub = cfg.flippers.sweepSubsteps;
      // Flipper overlap and contact handling run for every ball in play.
      for (bi = 0; bi < bodies.length; bi++) {
        bb = bodies[bi];
        if (!bb.active) continue;
        PB.Flipper.sweepResolve(world, sim.left, bb, fsub);
        PB.Flipper.sweepResolve(world, sim.right, bb, fsub);
      }
      for (bi = 0; bi < bodies.length; bi++) {
        bb = bodies[bi];
        if (!bb.active) continue;
        for (i = 0; i < bb.contacts.length; i++) {
          c = bb.contacts[i];
          if (c.circle) {
            PB.Bumper.hit(c.circle);
            sim.events.push({ type: 'bumper', circle: c.circle });
          } else if (c.seg) {
            if (c.seg.kind === 'slingshot') {
              c.seg.lit = cfg.slingshots.litSeconds;
              sim.events.push({ type: 'slingshot', seg: c.seg });
            } else if (c.seg.kind === 'drop') {
              if (PB.Target.drop(c.seg)) {
                sim.events.push({ type: 'drop', seg: c.seg });
                if (PB.Target.allDown(sim.bank)) {
                  sim.events.push({ type: 'dropbank' });
                  sim.bank.resetTimer = cfg.dropTargets.resetSeconds;
                }
              }
            } else if (c.seg.kind === 'standup') {
              if (c.seg.cooldown <= 0) {            // debounce repeat contacts
                c.seg.cooldown = cfg.standups.cooldown;
                c.seg.lit = cfg.standups.litSeconds;
                sim.events.push({ type: 'standup', seg: c.seg });
              }
            }
          }
        }
      }

      for (i = 0; i < world.segments.length; i++) {
        var sg = world.segments[i];
        if (sg.lit > 0) { sg.lit -= dt; if (sg.lit < 0) sg.lit = 0; }
        if (sg.cooldown > 0) { sg.cooldown -= dt; if (sg.cooldown < 0) sg.cooldown = 0; }
      }
      for (i = 0; i < world.circles.length; i++) PB.Bumper.update(world.circles[i], dt);
      PB.Target.update(sim.bank, dt);

      // Drain: a lost ball during multiball just leaves play (no life); the last
      // ball draining is the real drain the game-rules layer reacts to.
      for (i = bodies.length - 1; i >= 0; i--) {
        bb = bodies[i];
        if (bb.active && (bb.pos.y > cfg.physics.drainY ||
            bb.pos.x < -40 || bb.pos.x > cfg.view.width + 40)) {
          bb.active = false;
          if (bodies.length > 1) {
            bodies.splice(i, 1);
            if (sim.ball === bb) sim.ball = bodies[0];
            sim.events.push({ type: 'balldrain' });
          } else {
            sim.events.push({ type: 'drain' });
          }
        }
      }

      // Time-dilation charge/drain reads this step's events, so it runs last.
      PB.timedilation.postStep(sim, dt);
    },
  };

  // ===========================================================================
  // Game-rules layer: score, multiplier, ranks, ball count, ball save. Pure
  // enough to drive headlessly from the self-test.
  // ===========================================================================

  PB.Game = {
    create: function (settings) {
      return {
        state: 'attract',
        settings: settings,
        scoring: PB.Scoring.create(),
        sim: PB.sim.create(),
        missions: PB.Missions.create(),
        ballsLeft: cfg.game.balls,
        ballNumber: 1,
        ballSaveTimer: 0,
        ballSaveArmed: true,
        message: '', messageTimer: 0,
        audioEvents: [],
      };
    },

    // Queue a one-shot sound cue. The app layer drains these and plays them; the
    // sim/rules stay deterministic because this list never feeds back into them.
    cue: function (g, name) {
      if (g && g.audioEvents) g.audioEvents.push(name);
    },

    start: function (g) {
      g.scoring = PB.Scoring.create();
      g.sim = PB.sim.create();
      g.missions = PB.Missions.create();
      g.ballsLeft = cfg.game.balls;
      g.ballNumber = 1;
      g.ballSaveTimer = 0;
      g.ballSaveArmed = true;
      g.message = ''; g.messageTimer = 0;
      g.audioEvents = [];
      PB.sim.spawnBall(g.sim);
      g.state = 'ready';
    },

    setMessage: function (g, msg) {
      g.message = msg;
      g.messageTimer = cfg.game.messageSeconds;
    },

    update: function (g, input, dt) {
      if (g.state !== 'ready' && g.state !== 'playing') return;
      g.audioEvents.length = 0;
      if (g.messageTimer > 0) { g.messageTimer -= dt; if (g.messageTimer < 0) g.messageTimer = 0; }

      PB.sim.step(g.sim, input, dt);

      if (g.state === 'ready' && g.sim.ball.active && !PB.sim.inLane(g.sim)) {
        g.state = 'playing';
        if (g.ballSaveArmed) g.ballSaveTimer = cfg.game.ballSaveSeconds;
      }
      if (g.state === 'playing' && g.ballSaveTimer > 0) {
        g.ballSaveTimer -= dt;
        if (g.ballSaveTimer < 0) g.ballSaveTimer = 0;
      }

      var ev = g.sim.events;
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        if (e.type === 'bumper') { PB.Scoring.add(g.scoring, e.circle.score); PB.Game.cue(g, 'bumper'); }
        else if (e.type === 'slingshot') { PB.Scoring.add(g.scoring, e.seg.score); PB.Game.cue(g, 'sling'); }
        else if (e.type === 'drop') { PB.Scoring.add(g.scoring, e.seg.score); PB.Game.cue(g, 'target'); }
        else if (e.type === 'standup') { PB.Scoring.add(g.scoring, e.seg.score); PB.Game.cue(g, 'standup'); }
        else if (e.type === 'launch') PB.Game.cue(g, 'plunger');
        else if (e.type === 'balldrain') PB.Game.cue(g, 'balldrain');
        else if (e.type === 'dilate') PB.Game.cue(g, 'dilate');
        else if (e.type === 'dropbank') {
          PB.Scoring.addRaw(g.scoring, cfg.score.dropBank);
          PB.Scoring.bumpMultiplier(g.scoring, 1, cfg.game.multiplierCap);
          PB.Game.setMessage(g, S.bankCleared);
          PB.Game.cue(g, 'bank');
        } else if (e.type === 'drain') {
          PB.Game.onDrain(g);
        }
        PB.Missions.onEvent(g, e);
      }

      PB.Missions.tick(g, dt);

      var promo = PB.Scoring.updateRank(g.scoring);
      if (promo) { PB.Game.setMessage(g, S.promoted + promo); PB.Game.cue(g, 'rankup'); }
    },

    onDrain: function (g) {
      if (g.state === 'playing' && g.ballSaveTimer > 0) {
        g.ballSaveArmed = false;
        g.ballSaveTimer = 0;
        PB.sim.spawnBall(g.sim);
        g.state = 'ready';
        PB.Game.setMessage(g, S.ballSaved);
        PB.Game.cue(g, 'ballSaved');
        return;
      }
      PB.Game.cue(g, 'drain');
      g.ballsLeft--;
      if (g.ballsLeft > 0) {
        g.ballNumber++;
        g.scoring.multiplier = 1;
        g.ballSaveArmed = true;
        g.ballSaveTimer = 0;
        PB.sim.spawnBall(g.sim);
        g.state = 'ready';
        PB.Game.setMessage(g, S.ballLabel + g.ballNumber);
      } else {
        g.state = 'gameover';
      }
    },
  };

  // ===========================================================================
  // Self-test  — moved to js/selftest.js (loaded before this file). Kept out of
  // main.js so this module stays closer to a single responsibility (boot + loop
  // + screen state). PB.selfTest reads PB.sim / PB.Game at call time, so it does
  // not matter that those are defined here, after it loads.
  // ===========================================================================

  // ===========================================================================
  // App: input, loop, screen state machine, rendering, menus.
  // ===========================================================================

  var app = {
    canvas: null, ctx: null, input: null, game: null,
    particles: null, camera: null,
    touch: { flipperLeft: false, flipperRight: false, plungerHeld: false },
    save: null, stars: [], screen: 'attract',
    menuIndex: 0, settingsFrom: 'attract',
    capturing: false, capIdx: -1,
    go: { entering: false, initials: ['A', 'A', 'A'], pos: 0, qualifies: false },
    reduced: false,
    // Audio gesture + edge tracking for input-driven sounds.
    audioReady: false, prevFlipL: false, prevFlipR: false, prevTilted: false,
    // First-run onboarding: a bottom controls strip for the opening seconds of a
    // game, and a transient "callout" banner for innovation moments (slo-mo armed,
    // table transformed). These are app-layer only and never touch the sim.
    controlsTimer: 0,
    callout: { text: '', timer: 0, color: '' },
    prevMode: 0, prevArmed: false, seenDilation: false,
  };

  // Raise a transient banner (table transformed, slo-mo ready). App-layer only.
  function setCallout(text, color, seconds) {
    app.callout.text = text;
    app.callout.color = color;
    app.callout.timer = seconds;
  }

  function keyName(code) {
    if (!code) return '?';
    return code
      .replace('Arrow', '').replace('Key', '').replace('Digit', '')
      .replace('Left', ' L').replace('Right', ' R');
  }

  // ---- Starfield ----
  function buildStarfield() {
    var w = cfg.view.width, h = cfg.view.height, stars = [];
    cfg.starfield.layers.forEach(function (layer, li) {
      for (var i = 0; i < layer.count; i++) {
        stars.push({ x: Math.random() * w, y: Math.random() * h,
          r: layer.size * (0.6 + Math.random() * 0.8), speed: layer.speed,
          color: layer.color, layer: li });
      }
    });
    return stars;
  }
  function updateStars(dt) {
    if (app.reduced) return;
    var h = cfg.view.height;
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      s.y += s.speed * dt;
      if (s.y > h + 2) { s.y = -2; s.x = Math.random() * cfg.view.width; }
    }
  }
  function drawBackground(ctx, w, h) {
    // The gradient depends only on the fixed canvas size, so build it once.
    if (!app._bgGrad) {
      var g = ctx.createRadialGradient(w * 0.5, h * 0.3, 40, w * 0.5, h * 0.5, h * 0.8);
      g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#05060f');
      app._bgGrad = g;
    }
    ctx.fillStyle = app._bgGrad; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- Table rendering ----
  function drawTable(ctx, sim) {
    var world = sim.world;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = cfg.theme.wall;
    ctx.shadowColor = 'rgba(88,112,200,0.8)';
    ctx.shadowBlur = app.reduced ? 0 : 10; ctx.lineWidth = 4;
    ctx.beginPath();
    for (var i = 0; i < world.segments.length; i++) {
      var s = world.segments[i];
      // Morph deflectors (drawn by PB.transform) and retracted walls are skipped.
      if (s.kind !== 'wall' || s.morph || s.active === false) continue;
      ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    ctx.restore();

    // Innovations: the time-dilation zone sits under the elements; the
    // transformation deflectors render in their own neon style.
    PB.timedilation.draw(ctx, sim, app.reduced);
    PB.transform.draw(ctx, sim, app.reduced);

    for (i = 0; i < world.segments.length; i++) {
      s = world.segments[i];
      if (s.kind === 'slingshot') {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineWidth = 9;
        var lit = s.lit > 0;
        ctx.strokeStyle = lit ? cfg.theme.neonAmber : cfg.theme.neonMagenta;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = app.reduced ? 0 : (lit ? 22 : 10);
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
        ctx.restore();
      } else if (s.kind === 'drop') {
        PB.Target.draw(ctx, s);
      } else if (s.kind === 'standup') {
        drawStandup(ctx, s);
      }
    }

    for (i = 0; i < world.circles.length; i++) PB.Bumper.draw(ctx, world.circles[i]);
    PB.Flipper.draw(ctx, sim.left);
    PB.Flipper.draw(ctx, sim.right);
    PB.Plunger.draw(ctx, sim.plunger, sim.lane.x, sim.lane.w);
    // "Shoot here now" cues sit above the elements but under the ball.
    drawObjectiveCues(ctx, sim);
    for (i = 0; i < world.bodies.length; i++) {
      if (world.bodies[i].active) PB.Ball.draw(ctx, world.bodies[i], app._alpha || 0);
    }
  }

  // A standup target. Rendered as a clear physical target (a backing plate plus a
  // face) so it reads as something to shoot, not a faint dash: lit -> bright
  // mission-colored face with a white core and its label; unlit -> a steady,
  // still-visible dim target. The white core is a redundant (non-color) "armed"
  // cue that survives the colorblind palette and reduced motion.
  function drawStandup(ctx, seg) {
    var col = PB.Missions.standupColor(app.game, seg);
    var ax = seg.a.x, ay = seg.a.y, bx = seg.b.x, by = seg.b.y;
    ctx.save();
    ctx.lineCap = 'round';

    // Backing plate: always present so the target looks like a physical object.
    ctx.strokeStyle = 'rgba(40,52,90,0.9)';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

    if (col) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.shadowColor = col;
      ctx.shadowBlur = app.reduced ? 0 : 14;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      // Bright white core: a shape/brightness cue independent of hue.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      // Label below the bar (never under the top HUD column).
      ctx.fillStyle = col;
      ctx.font = '600 9px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seg.name, (ax + bx) / 2, Math.max(ay, by) + 15);
    } else {
      // Unlit but still clearly a target (more visible than the old faint dash).
      ctx.strokeStyle = 'rgba(150,170,210,0.5)';
      ctx.lineWidth = 5;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.restore();
  }

  // Animated "shoot here now" cue on whatever element the current mission wants:
  // a pulsing ring plus a bobbing chevron pointing at the target. Under reduced
  // motion the ring and chevron are steady (still a redundant, non-color cue). The
  // animation is render-time only and never touches the deterministic simulation.
  function drawObjectiveCues(ctx, sim) {
    var g = app.game; if (!g || !g.missions) return;
    var m = g.missions, reduced = app.reduced;
    var now = (typeof performance !== 'undefined') ? performance.now() : 0;
    var pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(now / 300);
    var bob = reduced ? 0 : 3 * Math.sin(now / 300);
    var col = cfg.theme.neonAmber, i, seg;

    function cue(x, y, r) {
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.45 * pulse;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = col;
      ctx.shadowBlur = reduced ? 0 : 10;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
      // Chevron above the target, pointing down at it.
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.shadowBlur = 0;
      var cy = y - r - 12 + bob;
      ctx.beginPath();
      ctx.moveTo(x - 5, cy); ctx.lineTo(x + 5, cy); ctx.lineTo(x, cy + 6); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
    function cueSeg(s) { cue((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, 12); }

    if (m.state === 'selected') {
      for (i = 0; i < sim.standups.length; i++) {
        if (sim.standups[i].role === 'start') cueSeg(sim.standups[i]);
      }
    } else if (m.state === 'active') {
      var d = PB.Missions.defs()[m.active];
      if (d.objective === 'bumpers') {
        for (i = 0; i < sim.world.circles.length; i++) {
          var c = sim.world.circles[i]; cue(c.x, c.y, c.r);
        }
      } else if (d.objective === 'bank') {
        for (i = 0; i < sim.bank.targets.length; i++) {
          seg = sim.bank.targets[i]; if (seg.active) cueSeg(seg);
        }
      } else if (d.objective === 'rescue') {
        for (i = 0; i < sim.standups.length; i++) {
          seg = sim.standups[i];
          if (seg.role === 'select' && seg.id === 2) cueSeg(seg);
        }
      }
    }
  }

  // ---- Screen input handlers ----
  function handleAttract(e) {
    if (e.enter) {
      PB.Game.start(app.game);
      app.screen = 'play';
      // Re-show the controls along the bottom for the opening seconds, and reset
      // the per-game first-time callout tracking.
      app.controlsTimer = 5;
      app.callout.timer = 0;
      app.prevMode = PB.transform.mode(app.game.sim);
      app.prevArmed = false;
      app.seenDilation = false;
    }
    else if (e.escape) { app.screen = 'settings'; app.settingsFrom = 'attract'; app.menuIndex = 0; }
  }

  function handlePlay(e, dt) {
    if (e.pause || e.escape) { app.screen = 'pause'; app.menuIndex = 0; return; }

    // Combine keyboard and touch held-states.
    var fl = app.input.flipperLeft || app.touch.flipperLeft;
    var fr = app.input.flipperRight || app.touch.flipperRight;
    var pl = app.input.plungerHeld || app.touch.plungerHeld;

    // Input-driven sounds: flipper actuation on the press edge.
    if (fl && !app.prevFlipL) PB.audio.sfx('flipper');
    if (fr && !app.prevFlipR) PB.audio.sfx('flipper');
    app.prevFlipL = fl;
    app.prevFlipR = fr;

    PB.Game.update(app.game, {
      plungerHeld: pl,
      flipperLeft: fl,
      flipperRight: fr,
      nudgeL: e.nudgeL, nudgeR: e.nudgeR, nudgeU: e.nudgeU,
    }, dt);

    // Nudge feedback: a small camera bump so a nudge feels physical (the ball also
    // jolts and the tilt meter climbs). Only when the nudge actually applies (not
    // tilted) and not under reduced motion.
    if (!app.game.sim.tilt.tilted && (e.nudgeL || e.nudgeR || e.nudgeU) && !app.reduced) {
      PB.camera.shake(app.camera, 0.18);
    }

    // Sound + particles + screen shake from this step's events and cues.
    reactToPlay();

    // Tilt lockout triggers on the rising edge of the tilt flag.
    var tilted = app.game.sim.tilt.tilted;
    if (tilted && !app.prevTilted) {
      PB.audio.sfx('tilt');
      if (!app.reduced) PB.camera.shake(app.camera, 0.5);
    }
    app.prevTilted = tilted;

    // Innovation callouts (rising-edge detected here, drawn over the HUD).
    var sim = app.game.sim;
    var mode = PB.transform.mode(sim);
    if (mode !== app.prevMode) {
      var label = mode ? S.tableAsteroid : S.tableStation;
      setCallout(label, mode ? cfg.theme.neonAmber : cfg.theme.neonCyan, 1.9);
      app.prevMode = mode;
    }
    var armed = sim.dilation && sim.dilation.charge >= 1;
    if (armed && !app.prevArmed && !app.seenDilation && !(sim.dilation && sim.dilation.active)) {
      setCallout(S.dilationReady, cfg.theme.neonCyan, 2.6);
      app.seenDilation = true;
    }
    app.prevArmed = armed;

    if (app.game.state === 'gameover') enterGameOver();
  }

  // Translate the step's physical contacts and queued cues into audio, pooled
  // particles, and screen shake. Heavy bursts are gated behind reduced motion.
  function reactToPlay() {
    var g = app.game, reduced = app.reduced, T = cfg.theme;
    var ball = g.sim.ball;
    var bx = ball ? ball.pos.x : cfg.view.width / 2;
    var by = ball ? ball.pos.y : cfg.view.height / 2;
    var ev = g.sim.events, i, x, y;
    // Screen shake is motion, so reduced-motion suppresses it entirely.
    function shake(amt) { if (!reduced) PB.camera.shake(app.camera, amt); }

    for (i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'bumper') {
        if (!reduced) PB.particles.burst(app.particles, e.circle.x, e.circle.y, 10, T.neonAmber, 260);
        shake(0.12);
      } else if (e.type === 'slingshot' || e.type === 'drop' || e.type === 'standup') {
        x = (e.seg.a.x + e.seg.b.x) / 2; y = (e.seg.a.y + e.seg.b.y) / 2;
        var col = e.type === 'drop' ? T.neonGreen : (e.type === 'standup' ? T.neonCyan : T.neonMagenta);
        if (!reduced) PB.particles.burst(app.particles, x, y, 7, col, 230);
      }
    }

    var ae = g.audioEvents;
    for (i = 0; i < ae.length; i++) {
      var name = ae[i];
      PB.audio.sfx(name);
      if (name === 'jackpot') {
        shake(0.8);
        if (!reduced) PB.particles.burst(app.particles, bx, by, 28, T.neonAmber, 360);
        PB.particles.popup(app.particles, bx, by - 18, S.jackpot, T.neonAmber);
      } else if (name === 'multiball') {
        shake(0.7);
        if (!reduced) PB.particles.burst(app.particles, bx, by, 24, T.neonCyan, 340);
        PB.particles.popup(app.particles, bx, by - 18, S.mMultiball, T.neonCyan);
      } else if (name === 'rankup') {
        // The promotion is announced by the centered "PROMOTED: <rank>" banner
        // (PB.Game.setMessage); no duplicate ball-anchored popup (it double-notified
        // the same event in a second color/place). Just the celebratory shake here.
        shake(0.45);
      } else if (name === 'bank') {
        shake(0.3);
        PB.particles.popup(app.particles, bx, by - 18, '+' + PB.format.commas(cfg.score.dropBank), T.neonGreen);
      } else if (name === 'dilate') {
        shake(0.3);
      } else if (name === 'drain') {
        shake(0.5);
      }
    }
  }

  var PAUSE_ITEMS = 3;
  function handlePause(e) {
    if (e.escape || e.pause) { app.screen = 'play'; return; }
    if (e.up) app.menuIndex = (app.menuIndex + PAUSE_ITEMS - 1) % PAUSE_ITEMS;
    if (e.down) app.menuIndex = (app.menuIndex + 1) % PAUSE_ITEMS;
    if (e.enter) {
      if (app.menuIndex === 0) app.screen = 'play';
      else if (app.menuIndex === 1) { app.screen = 'settings'; app.settingsFrom = 'pause'; app.menuIndex = 0; }
      else { app.screen = 'attract'; }
    }
  }

  // Rebindable rows 4..10 map to these keymap fields in order.
  var REBIND_FIELDS = ['flipperLeft', 'flipperRight', 'plunger',
                       'nudgeLeft', 'nudgeRight', 'nudgeUp', 'pause'];
  var REBIND_FIRST = 4;
  var REBIND_LAST = REBIND_FIRST + REBIND_FIELDS.length - 1;   // 10
  var SETTINGS_BACK = REBIND_LAST + 1;                          // 11
  var SETTINGS_ITEMS = SETTINGS_BACK + 1;                       // 12

  function handleSettings(e) {
    if (app.capturing) return; // waiting for a key; ignore navigation
    var st = app.save.settings;
    if (e.escape) { backFromSettings(); return; }
    if (e.up) app.menuIndex = (app.menuIndex + SETTINGS_ITEMS - 1) % SETTINGS_ITEMS;
    if (e.down) app.menuIndex = (app.menuIndex + 1) % SETTINGS_ITEMS;

    var i = app.menuIndex;
    if (e.left || e.right) {
      var dir = e.right ? 1 : -1;
      if (i === 0) { st.volume = Math.max(0, Math.min(1, st.volume + dir * 0.1)); PB.audio.applySettings(st); }
      else if (i === 1) { st.muted = !st.muted; PB.audio.applySettings(st); }
      else if (i === 2) { st.reducedMotion = !st.reducedMotion; app.reduced = PB.reduced = st.reducedMotion; }
      else if (i === 3) { st.colorblind = !st.colorblind; PB.applyPalette(st.colorblind); }
      PB.storage.save(app.save);
    }
    if (e.enter) {
      if (i >= REBIND_FIRST && i <= REBIND_LAST) startRebind(i);
      else if (i === 1) { st.muted = !st.muted; PB.audio.applySettings(st); PB.storage.save(app.save); }
      else if (i === 2) { st.reducedMotion = !st.reducedMotion; app.reduced = PB.reduced = st.reducedMotion; PB.storage.save(app.save); }
      else if (i === 3) { st.colorblind = !st.colorblind; PB.applyPalette(st.colorblind); PB.storage.save(app.save); }
      else if (i === SETTINGS_BACK) backFromSettings();
    }
  }

  function startRebind(i) {
    app.capturing = true; app.capIdx = i;
    var field = REBIND_FIELDS[i - REBIND_FIRST];
    app.input.captureKey(function (code) {
      if (code) { // null means the rebind was cancelled with Escape
        app.save.settings.keymap[field] = code;
        app.input.setKeymap(app.save.settings.keymap);
        PB.storage.save(app.save);
      }
      app.capturing = false; app.capIdx = -1;
    });
  }

  function backFromSettings() {
    app.screen = app.settingsFrom === 'pause' ? 'pause' : 'attract';
    app.menuIndex = 0;
  }

  function enterGameOver() {
    app.screen = 'gameover';
    var q = PB.storage.qualifies(app.save, app.game.scoring.score) && app.game.scoring.score > 0;
    app.go = { entering: q, initials: ['A', 'A', 'A'], pos: 0, qualifies: q };
  }

  function handleGameOver(e) {
    if (app.go.entering) {
      var ini = app.go.initials;
      if (e.left) app.go.pos = (app.go.pos + 2) % 3;
      if (e.right) app.go.pos = (app.go.pos + 1) % 3;
      if (e.up || e.down) {
        var c = ini[app.go.pos].charCodeAt(0);
        c += e.up ? 1 : -1;
        if (c > 90) c = 65; if (c < 65) c = 90;
        ini[app.go.pos] = String.fromCharCode(c);
      }
      if (e.enter) {
        PB.storage.addHighScore(app.save, ini.join(''), app.game.scoring.score,
                                PB.Scoring.rank(app.game.scoring).name);
        app.go.entering = false;
      }
    } else if (e.enter) {
      app.screen = 'attract';
    }
  }

  // ---- Loop ----
  function update(dt) {
    updateStars(dt);
    var e = app.input.consume();
    switch (app.screen) {
      case 'attract': handleAttract(e); break;
      case 'play': handlePlay(e, dt); break;
      case 'pause': handlePause(e); break;
      case 'settings': handleSettings(e); break;
      case 'gameover': handleGameOver(e); break;
    }
    PB.particles.update(app.particles, dt);
    PB.camera.update(app.camera, dt);

    // Onboarding timers (app-layer, do not affect the sim).
    if (app.controlsTimer > 0) { app.controlsTimer -= dt; if (app.controlsTimer < 0) app.controlsTimer = 0; }
    if (app.callout.timer > 0) { app.callout.timer -= dt; if (app.callout.timer < 0) app.callout.timer = 0; }
  }

  // A transient innovation banner (slo-mo ready, table transformed), centered just
  // below the main message line so the two never collide. Fades out near the end.
  function drawCallout(ctx) {
    if (app.callout.timer <= 0 || !app.callout.text) return;
    var w = cfg.view.width;
    var a = Math.min(1, app.callout.timer * 1.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '800 22px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = app.callout.color || cfg.theme.neonCyan;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = app.reduced ? 0 : 16;
    ctx.fillText(app.callout.text, w / 2, 520);
    ctx.restore();
  }

  // Steady (no blink) under reduced motion; otherwise a ~1 Hz blink.
  function blinkOn() { return PB.reduced || Math.floor(performance.now() / 450) % 2 === 0; }

  function settingsLines() {
    var st = app.save.settings;
    function val(i, txt) { return (app.capturing && app.capIdx === i) ? S.pressAKey : txt; }
    return [
      S.volume + ':  ' + Math.round(st.volume * 100) + '%',
      S.mute + ':  ' + (st.muted ? S.on : S.off),
      S.reducedMotion + ':  ' + (st.reducedMotion ? S.on : S.off),
      S.colorblind + ':  ' + (st.colorblind ? S.on : S.off),
      S.rebindLeft + ':  ' + val(4, keyName(st.keymap.flipperLeft)),
      S.rebindRight + ':  ' + val(5, keyName(st.keymap.flipperRight)),
      S.rebindPlunger + ':  ' + val(6, keyName(st.keymap.plunger)),
      S.rebindNudgeLeft + ':  ' + val(7, keyName(st.keymap.nudgeLeft)),
      S.rebindNudgeRight + ':  ' + val(8, keyName(st.keymap.nudgeRight)),
      S.rebindNudgeUp + ':  ' + val(9, keyName(st.keymap.nudgeUp)),
      S.rebindPause + ':  ' + val(10, keyName(st.keymap.pause)),
      S.back,
    ];
  }

  // Music intensity from game state: 0 menus, 1 in play, 2 mission, 3 multiball.
  function musicIntensity() {
    if (app.screen !== 'play' || !app.game) return 0;
    var g = app.game;
    if (g.state !== 'playing' && g.state !== 'ready') return 0;
    if (g.missions.multiball) return 3;
    if (g.missions.state === 'active') return 2;
    return 1;
  }

  function render(alpha) {
    var ctx = app.ctx, w = cfg.view.width, h = cfg.view.height;
    app._alpha = alpha;
    PB.audio.tick(musicIntensity());
    drawBackground(ctx, w, h);

    switch (app.screen) {
      case 'attract':
        PB.Menus.drawAttract(ctx, app.save, blinkOn());
        break;
      case 'play':
        PB.camera.begin(ctx, app.camera);
        drawTable(ctx, app.game.sim);
        PB.particles.draw(ctx, app.particles);
        PB.camera.end(ctx);
        PB.Hud.draw(ctx, app.game);
        drawCallout(ctx);
        // Controls reminder along the bottom for the opening seconds of a game.
        if (app.controlsTimer > 0) PB.Menus.drawControls(ctx, 700);
        break;
      case 'pause':
        drawTable(ctx, app.game.sim);
        PB.particles.draw(ctx, app.particles);
        PB.Menus.drawMenu(ctx, S.paused,
          [S.resume, S.settings, S.quitToTitle], app.menuIndex, S.pauseFooter);
        break;
      case 'settings':
        if (app.settingsFrom === 'pause' && app.game) drawTable(ctx, app.game.sim);
        PB.Menus.drawMenu(ctx, S.settingsTitle, settingsLines(), app.menuIndex, S.settingsFooter);
        break;
      case 'gameover':
        if (app.game) drawTable(ctx, app.game.sim);
        PB.Menus.drawGameOver(ctx, {
          score: app.game.scoring.score,
          rankName: PB.Scoring.rank(app.game.scoring).name,
          entering: app.go.entering,
          initials: app.go.initials,
          pos: app.go.pos,
          highScores: app.save.highScores,
          blinkOn: blinkOn(),
        });
        break;
    }
  }

  // ---- Touch / pointer controls ----
  // Makes the core loop playable without a keyboard: the lower playfield is split
  // into left/right flipper zones, the plunger lane is a hold-to-charge zone, and
  // a tap on any menu screen confirms. Multitouch is tracked per pointer id so
  // both flippers can be held at once. Mouse pointers work the same way.
  function setupTouch() {
    var c = app.canvas;
    var pointers = {};   // pointerId -> 'L' | 'R' | 'P'

    function toView(ev) {
      var rect = c.getBoundingClientRect();
      return {
        x: (ev.clientX - rect.left) / rect.width * cfg.view.width,
        y: (ev.clientY - rect.top) / rect.height * cfg.view.height,
      };
    }
    function roleAt(v) {
      if (v.x > 520 && v.y > 620) return 'P';            // plunger lane
      return v.x < cfg.view.width / 2 ? 'L' : 'R';        // left / right flipper
    }
    function recompute() {
      var l = false, r = false, p = false, id;
      for (id in pointers) {
        if (pointers[id] === 'L') l = true;
        else if (pointers[id] === 'R') r = true;
        else if (pointers[id] === 'P') p = true;
      }
      app.touch.flipperLeft = l; app.touch.flipperRight = r; app.touch.plungerHeld = p;
    }
    function release(ev) { if (pointers[ev.pointerId]) { delete pointers[ev.pointerId]; recompute(); } }

    c.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (app.screen === 'play') {
        pointers[ev.pointerId] = roleAt(toView(ev));
        recompute();
      } else {
        // Menus: a tap confirms the current item (start, continue, resume, back).
        app.input._edges.enter = true;
      }
    });
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('pointerout', release);
  }

  // ---- Boot ----
  function init() {
    app.canvas = document.getElementById('game');
    if (!app.canvas) { console.error('Canvas #game not found.'); return; }
    app.ctx = app.canvas.getContext('2d');
    app.stars = buildStarfield();

    if (/(?:^|[?&])selftest/.test(location.search)) {
      app.save = PB.storage.defaults();
      app.game = PB.Game.create(app.save.settings);
      var res = PB.selfTest.run();
      drawBackground(app.ctx, cfg.view.width, cfg.view.height);
      app.ctx.fillStyle = res.ok ? cfg.theme.neonGreen : cfg.theme.neonRed;
      app.ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
      app.ctx.textAlign = 'center';
      app.ctx.fillText(res.msg, cfg.view.width / 2, cfg.view.height / 2);
      return;
    }

    app.save = PB.storage.load();
    app.reduced = !!app.save.settings.reducedMotion;
    PB.reduced = app.reduced;
    PB.applyPalette(app.save.settings.colorblind);
    app.game = PB.Game.create(app.save.settings);
    app.input = PB.input.create(app.save.settings.keymap);
    app.particles = PB.particles.create();
    app.camera = PB.camera.create();

    // Browser autoplay policy: the audio context can only start from a user
    // gesture. Create it (and apply saved volume/mute) on the first key or
    // pointer, then drop the listeners.
    function startAudio() {
      if (app.audioReady) return;
      app.audioReady = true;
      PB.audio.ensure();
      PB.audio.applySettings(app.save.settings);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('pointerdown', startAudio);
    }
    window.addEventListener('keydown', startAudio);
    window.addEventListener('pointerdown', startAudio);

    setupTouch();

    var loop = PB.loop.create({
      hz: cfg.sim.hz, maxSubSteps: cfg.sim.maxSubSteps,
      update: update, render: render,
    });
    loop.start();
    PB.app = app;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.PB = window.PB || {});
