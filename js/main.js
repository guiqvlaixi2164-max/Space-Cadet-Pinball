// main.js - entry point, world assembly, the fixed-step game loop, and rendering.
// Phase 2 turns the sandbox into something that plays like pinball: two flippers
// that impart kick, pop bumpers, slingshots, a drop-target bank, and nudge/tilt
// with a TILT lockout. The table geometry is still built inline here; in Phase 3
// it moves into js/tables/classic.js as data with js/game/table.js building it.

(function (PB) {
  'use strict';

  var cfg = PB.config;
  var strings = PB.strings;

  var SPAWN = { x: 552, y: 853 };  // ball rest position in the plunger lane
  var LANE = { x: 538, w: 28 };    // plunger lane bounds (for drawing)

  // ---- World assembly -------------------------------------------------------

  PB.sim = {
    buildGeometry: function (sim) {
      var world = sim.world;
      var S = PB.makeSegment;
      var sl = cfg.slingshots;

      // Outer shell with rounded top corners (arcs demonstrate ramp.js) and the
      // plunger lane on the right.
      var segs = [
        S(24, 120, 24, 740),       // left wall
        S(120, 24, 470, 24),       // top wall
        S(566, 120, 566, 862),     // right outer wall (also lane outer)
        S(538, 300, 538, 862),     // lane divider (open above y=300)
        S(538, 862, 566, 862),     // lane floor (ball rests here)
        S(24, 740, 150, 805),      // left lower wall
        S(538, 560, 410, 805),     // right lower wall
      ];
      // Rounded corners: a launched ball rides the right corner over the top.
      segs = segs
        .concat(PB.Ramp.arc(120, 120, 96, Math.PI, Math.PI * 1.5, 6))
        .concat(PB.Ramp.arc(470, 120, 96, Math.PI * 1.5, Math.PI * 2, 6));
      for (var i = 0; i < segs.length; i++) world.segments.push(segs[i]);

      // Slingshots (bouncy, scoring) just above and inside each flipper.
      var slOpts = { kind: 'slingshot', restitution: sl.restitution,
                     kick: sl.kick, score: cfg.score.slingshot };
      world.segments.push(S(150, 805, 196, 745, slOpts)); // left
      world.segments.push(S(410, 805, 364, 745, slOpts)); // right

      // Drop-target bank.
      sim.bank = PB.Target.createBank();
      for (i = 0; i < sim.bank.targets.length; i++) {
        world.segments.push(sim.bank.targets[i]);
      }

      // Flippers.
      sim.left = PB.Flipper.create(cfg.flippers.left);
      sim.right = PB.Flipper.create(cfg.flippers.right);
      world.flippers.push(sim.left, sim.right);

      // Pop bumpers.
      for (i = 0; i < cfg.bumpers.list.length; i++) {
        var bm = PB.Bumper.create(cfg.bumpers.list[i]);
        world.circles.push(bm);
      }
    },

    create: function () {
      var sim = {
        world: PB.makeWorld(),
        ball: null,
        score: 0,
        drains: 0,
        lastLaunch: 0,
        tilt: { bob: 0, tilted: false },
        plunger: PB.Plunger.create(),
      };
      sim.ball = PB.makeBall(SPAWN.x, SPAWN.y, cfg.physics.ballRadius);
      sim.world.bodies.push(sim.ball);
      PB.sim.buildGeometry(sim);
      return sim;
    },

    spawnBall: function (sim) {
      var b = sim.ball;
      b.pos.x = SPAWN.x; b.pos.y = SPAWN.y;
      b.prev.x = SPAWN.x; b.prev.y = SPAWN.y;
      b.vel.x = 0; b.vel.y = 0;
      b.active = true;
      sim.tilt.tilted = false;
      sim.tilt.bob = 0;
    },

    // Advance the whole simulation one fixed step. "input" is a plain object so
    // this stays pure and replayable:
    // { plungerHeld, flipperLeft, flipperRight, nudgeL, nudgeR, nudgeU }.
    step: function (sim, input, dt) {
      var world = sim.world, ball = sim.ball, tilt = sim.tilt, t = cfg.tilt;

      // Tilt bob recovers over time.
      if (tilt.bob > 0) { tilt.bob -= t.bobDecay * dt; if (tilt.bob < 0) tilt.bob = 0; }

      // Nudges (ignored once tilted).
      if (!tilt.tilted) {
        if (input.nudgeL) { ball.vel.x -= t.nudgeImpulse; tilt.bob += t.nudgeBob; }
        if (input.nudgeR) { ball.vel.x += t.nudgeImpulse; tilt.bob += t.nudgeBob; }
        if (input.nudgeU) { ball.vel.y -= t.nudgeImpulse; tilt.bob += t.nudgeBob; }
        if (tilt.bob >= t.tiltAt) tilt.tilted = true;
      }

      // Plunger.
      var launched = PB.Plunger.update(sim.plunger, ball, !!input.plungerHeld, dt);
      if (launched) sim.lastLaunch = launched;

      // Flippers (dead while tilted).
      PB.Flipper.update(sim.left, !!input.flipperLeft && !tilt.tilted, dt);
      PB.Flipper.update(sim.right, !!input.flipperRight && !tilt.tilted, dt);

      // Integrate + collide, then resolve any flipper that swept into the ball.
      PB.step(world, dt);
      PB.Flipper.resolveOverlap(world, sim.left, ball);
      PB.Flipper.resolveOverlap(world, sim.right, ball);

      // Score and effects from this step's contacts.
      PB.sim.handleContacts(sim, ball.contacts);

      // Lit timers and bank reset.
      for (var i = 0; i < world.segments.length; i++) {
        var s = world.segments[i];
        if (s.lit > 0) { s.lit -= dt; if (s.lit < 0) s.lit = 0; }
      }
      for (i = 0; i < world.circles.length; i++) PB.Bumper.update(world.circles[i], dt);
      PB.Target.update(sim.bank, dt);

      // Drain.
      if (ball.pos.y > cfg.physics.drainY ||
          ball.pos.x < -40 || ball.pos.x > cfg.view.width + 40) {
        sim.drains++;
        PB.sim.spawnBall(sim);
      }
    },

    handleContacts: function (sim, contacts) {
      for (var i = 0; i < contacts.length; i++) {
        var c = contacts[i];
        if (c.circle) {
          PB.Bumper.hit(c.circle);
          sim.score += c.circle.score;
        } else if (c.seg) {
          if (c.seg.kind === 'slingshot') {
            c.seg.lit = cfg.slingshots.litSeconds;
            sim.score += c.seg.score;
          } else if (c.seg.kind === 'drop') {
            if (PB.Target.drop(c.seg)) {
              sim.score += c.seg.score;
              if (PB.Target.allDown(sim.bank)) {
                sim.score += cfg.score.dropBank;
                sim.bank.resetTimer = cfg.dropTargets.resetSeconds;
              }
            }
          }
        }
      }
    },
  };

  // ---- Self-test ------------------------------------------------------------

  PB.selfTest = {
    determinism: function () {
      function run() {
        var sim = PB.sim.create();
        var dt = 1 / cfg.sim.hz;
        var out = [];
        for (var i = 0; i < 1600; i++) {
          PB.sim.step(sim, {
            plungerHeld: i < 60,
            flipperLeft: i > 200 && i < 240,
            flipperRight: i > 900 && i < 940,
            nudgeR: i === 300,
          }, dt);
          if (i % 50 === 0) out.push(sim.ball.pos.x.toFixed(6) + ',' + sim.ball.pos.y.toFixed(6));
        }
        return out.join('|');
      }
      return run() === run();
    },

    noTunneling: function () {
      var sim = PB.sim.create();
      var b = sim.ball;
      b.pos.x = 300; b.pos.y = 420; b.prev.x = 300; b.prev.y = 420;
      b.vel.x = 80000; b.vel.y = 0;
      var dt = 1 / cfg.sim.hz;
      for (var i = 0; i < 6; i++) PB.step(sim.world, dt);
      return b.pos.x > 24 && b.pos.x < 566 && b.pos.y < cfg.physics.drainY;
    },

    flipperKick: function () {
      var sim = PB.sim.create();
      var b = sim.ball;
      b.pos.x = 235; b.pos.y = 805; b.prev.x = 235; b.prev.y = 805;
      b.vel.x = 0; b.vel.y = 0;
      var dt = 1 / cfg.sim.hz;
      var minVy = 0;
      for (var i = 0; i < 24; i++) {
        PB.sim.step(sim, { flipperLeft: true }, dt);
        if (b.vel.y < minVy) minVy = b.vel.y;
      }
      // A working flipper should propel the resting ball strongly upward.
      return minVy < -250;
    },

    run: function () {
      var det = PB.selfTest.determinism();
      var tun = PB.selfTest.noTunneling();
      var kick = PB.selfTest.flipperKick();
      var msg = 'SELFTEST det=' + (det ? 'OK' : 'FAIL') +
                ' tunnel=' + (tun ? 'OK' : 'FAIL') +
                ' flipper=' + (kick ? 'OK' : 'FAIL');
      try { document.title = msg; } catch (e) {}
      if (window.console) console.log(msg);
      return { ok: det && tun && kick, msg: msg };
    },
  };

  // ---- Rendering ------------------------------------------------------------

  var app = { canvas: null, ctx: null, sim: null, input: null, stars: [] };

  function commas(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

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
    var h = cfg.view.height;
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      s.y += s.speed * dt;
      if (s.y > h + 2) { s.y = -2; s.x = Math.random() * cfg.view.width; }
    }
  }

  function drawBackground(ctx, w, h) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.3, 40, w * 0.5, h * 0.5, h * 0.8);
    g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSegments(ctx, world) {
    // Plain walls in one glowing pass.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = cfg.theme.wall;
    ctx.shadowColor = 'rgba(88,112,200,0.8)';
    ctx.shadowBlur = 10; ctx.lineWidth = 4;
    ctx.beginPath();
    for (var i = 0; i < world.segments.length; i++) {
      var s = world.segments[i];
      if (s.kind !== 'wall') continue;
      ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    ctx.restore();

    // Special elements drawn individually.
    for (i = 0; i < world.segments.length; i++) {
      s = world.segments[i];
      if (s.kind === 'slingshot') {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineWidth = 9;
        var lit = s.lit > 0;
        ctx.strokeStyle = lit ? cfg.theme.neonAmber : cfg.theme.neonMagenta;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = lit ? 22 : 10;
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
        ctx.restore();
      } else if (s.kind === 'drop') {
        PB.Target.draw(ctx, s);
      }
    }
  }

  function drawTiltMeter(ctx, sim) {
    var t = cfg.tilt, bob = Math.min(sim.tilt.bob / t.tiltAt, 1);
    var x = cfg.view.width - 24, y = 120, h = 160;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(x, y, 8, h);
    var col = sim.tilt.tilted ? cfg.theme.neonRed
            : (sim.tilt.bob > t.warnAt ? cfg.theme.neonAmber : cfg.theme.neonGreen);
    ctx.fillStyle = col;
    ctx.fillRect(x, y + h * (1 - bob), 8, h * bob);
    ctx.restore();
  }

  function drawHud(ctx, sim) {
    ctx.save();
    ctx.textBaseline = 'top';

    ctx.font = '700 26px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = cfg.theme.neonCyan;
    ctx.fillText(commas(sim.score), 150, 40);

    ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = cfg.theme.neonCyan;
    ctx.fillText(strings.phase2Header, 150, 74);

    ctx.font = '400 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(223,241,255,0.78)';
    ctx.fillText(strings.controlsFlippers, 150, 94);
    ctx.fillText(strings.controlsPlunger, 150, 110);
    ctx.fillText(strings.controlsNudge + '   ' + strings.controlsReset, 150, 126);
    ctx.fillText(strings.drains + ': ' + sim.drains, 150, 146);

    // Tilt status.
    if (sim.tilt.tilted) {
      ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = cfg.theme.neonRed;
      ctx.textAlign = 'center';
      ctx.fillText(strings.tilted, cfg.view.width / 2, 300);
    } else if (sim.tilt.bob > cfg.tilt.warnAt) {
      ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = cfg.theme.neonAmber;
      ctx.textAlign = 'center';
      ctx.fillText(strings.tiltWarn, cfg.view.width / 2, 300);
    }
    ctx.restore();
  }

  function render(alpha) {
    var ctx = app.ctx, w = cfg.view.width, h = cfg.view.height, sim = app.sim;
    drawBackground(ctx, w, h);
    drawSegments(ctx, sim.world);
    for (var i = 0; i < sim.world.circles.length; i++) PB.Bumper.draw(ctx, sim.world.circles[i]);
    PB.Flipper.draw(ctx, sim.left);
    PB.Flipper.draw(ctx, sim.right);
    PB.Plunger.draw(ctx, sim.plunger, LANE.x, LANE.w);
    if (sim.ball.active) PB.Ball.draw(ctx, sim.ball, alpha);
    drawTiltMeter(ctx, sim);
    drawHud(ctx, sim);
  }

  function update(dt) {
    updateStars(dt);
    var e = app.input.consume();
    if (e.reset) PB.sim.spawnBall(app.sim);
    PB.sim.step(app.sim, {
      plungerHeld: app.input.plungerHeld,
      flipperLeft: app.input.flipperLeft,
      flipperRight: app.input.flipperRight,
      nudgeL: e.nudgeL, nudgeR: e.nudgeR, nudgeU: e.nudgeU,
    }, dt);
  }

  // ---- Boot -----------------------------------------------------------------

  function init() {
    app.canvas = document.getElementById('game');
    if (!app.canvas) { console.error('Canvas #game not found.'); return; }
    app.ctx = app.canvas.getContext('2d');
    app.stars = buildStarfield();
    app.sim = PB.sim.create();

    if (/(?:^|[?&])selftest/.test(location.search)) {
      var res = PB.selfTest.run();
      render(0);
      app.ctx.fillStyle = res.ok ? cfg.theme.neonGreen : cfg.theme.neonRed;
      app.ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
      app.ctx.textAlign = 'center';
      app.ctx.fillText(res.msg, cfg.view.width / 2, cfg.view.height / 2);
      return;
    }

    app.input = PB.input.create();
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
