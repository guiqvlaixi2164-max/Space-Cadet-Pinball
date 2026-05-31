// main.js - entry point, world assembly, the fixed-step game loop, and rendering.
// Phase 1 is a physics sandbox: a hardcoded boxed table with angled walls and a
// plunger lane. A ball obeys gravity, bounces with swept continuous collision
// (no tunneling), launches from the plunger, and drains off the bottom. The
// simulation is deterministic; open with ?selftest to verify that automatically.
//
// The table geometry built here is intentionally throwaway. In Phase 3 it moves
// into js/tables/classic.js as data and js/game/table.js builds bodies from it.

(function (PB) {
  'use strict';

  var cfg = PB.config;
  var strings = PB.strings;

  var SPAWN = { x: 557, y: 853 }; // ball rest position in the plunger lane
  var LANE = { x: 538, w: 38 };   // plunger lane bounds (for drawing the plunger)

  // ---- World assembly -------------------------------------------------------

  PB.sim = {
    buildGeometry: function (world) {
      var S = PB.makeSegment;
      // Outer shell and plunger lane.
      world.segments.push(
        S(24, 40, 24, 840),     // left wall
        S(24, 40, 524, 40),     // top wall
        S(524, 40, 576, 92),    // top-right chamfer (deflects launched ball left)
        S(576, 92, 576, 862),   // right outer wall (also lane outer)
        S(538, 300, 538, 862),  // lane divider (open above y=300)
        S(538, 862, 576, 862),  // lane floor (ball rests here)
        S(24, 840, 232, 892),   // left bottom funnel
        S(538, 720, 346, 892)   // right bottom funnel
      );
      // The gap between the two funnels (x ~232..346 at the bottom) is the drain.
    },

    create: function () {
      var world = PB.makeWorld();
      PB.sim.buildGeometry(world);
      var ball = PB.makeBall(SPAWN.x, SPAWN.y, cfg.physics.ballRadius);
      world.bodies.push(ball);
      return {
        world: world,
        ball: ball,
        plunger: PB.Plunger.create(),
        drains: 0,
        lastLaunch: 0,
      };
    },

    spawnBall: function (sim) {
      var b = sim.ball;
      b.pos.x = SPAWN.x; b.pos.y = SPAWN.y;
      b.prev.x = SPAWN.x; b.prev.y = SPAWN.y;
      b.vel.x = 0; b.vel.y = 0;
      b.active = true;
    },

    // Advance the whole simulation one fixed step. "input" is a plain object so
    // this is pure and replayable: { plungerHeld: bool }.
    step: function (sim, input, dt) {
      var launched = PB.Plunger.update(sim.plunger, sim.ball, !!input.plungerHeld, dt);
      if (launched) sim.lastLaunch = launched;

      PB.step(sim.world, dt);

      // Drain: ball fell past the bottom. Respawn in the lane.
      if (sim.ball.pos.y > cfg.physics.drainY ||
          sim.ball.pos.x < -40 || sim.ball.pos.x > cfg.view.width + 40) {
        sim.drains++;
        PB.sim.spawnBall(sim);
      }
    },
  };

  // ---- Self-test (determinism and anti-tunneling) ---------------------------

  PB.selfTest = {
    determinism: function () {
      function run() {
        var sim = PB.sim.create();
        var dt = 1 / cfg.sim.hz;
        var samples = [];
        for (var i = 0; i < 1600; i++) {
          PB.sim.step(sim, { plungerHeld: i < 60 }, dt); // charge 0.5s, then fly
          if (i % 50 === 0) {
            samples.push(sim.ball.pos.x.toFixed(6) + ',' + sim.ball.pos.y.toFixed(6));
          }
        }
        return samples.join('|');
      }
      return run() === run();
    },

    noTunneling: function () {
      var sim = PB.sim.create();
      var b = sim.ball;
      b.pos.x = 300; b.pos.y = 420; b.prev.x = 300; b.prev.y = 420;
      b.vel.x = 80000; b.vel.y = 0; // far more than one field width per step
      var dt = 1 / cfg.sim.hz;
      for (var i = 0; i < 6; i++) PB.step(sim.world, dt);
      // It must have bounced and stayed inside the outer walls, not escaped.
      return b.pos.x > 24 && b.pos.x < 576 && b.pos.y < cfg.physics.drainY;
    },

    run: function () {
      var det = PB.selfTest.determinism();
      var tun = PB.selfTest.noTunneling();
      var msg = 'SELFTEST det=' + (det ? 'OK' : 'FAIL') +
                ' tunnel=' + (tun ? 'OK' : 'FAIL');
      try { document.title = msg; } catch (e) {}
      if (window.console) console.log(msg);
      return { det: det, tun: tun, msg: msg };
    },
  };

  // ---- Rendering ------------------------------------------------------------

  var app = {
    canvas: null,
    ctx: null,
    sim: null,
    input: null,
    stars: [],
  };

  function buildStarfield() {
    var w = cfg.view.width, h = cfg.view.height, stars = [];
    cfg.starfield.layers.forEach(function (layer, li) {
      for (var i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * w, y: Math.random() * h,
          r: layer.size * (0.6 + Math.random() * 0.8),
          speed: layer.speed, color: layer.color, layer: li,
        });
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
    g.addColorStop(0, '#0b1026');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < app.stars.length; i++) {
      var s = app.stars[i];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWalls(ctx, world) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = cfg.theme.wall;
    ctx.shadowColor = 'rgba(88,112,200,0.8)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (var i = 0; i < world.segments.length; i++) {
      var s = world.segments[i];
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(ctx, sim) {
    ctx.save();
    ctx.fillStyle = cfg.theme.text;
    ctx.textBaseline = 'top';

    ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = cfg.theme.neonCyan;
    ctx.fillText(strings.phase1Header, 34, 52);

    ctx.font = '400 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(223,241,255,0.8)';
    ctx.fillText(strings.plungerHint, 34, 74);
    ctx.fillText(strings.resetHint, 34, 92);

    var speed = Math.round(Math.sqrt(
      sim.ball.vel.x * sim.ball.vel.x + sim.ball.vel.y * sim.ball.vel.y));
    ctx.textAlign = 'left';
    ctx.fillStyle = cfg.theme.text;
    ctx.fillText(strings.drains + ': ' + sim.drains, 34, 118);
    ctx.fillText(strings.speed + ': ' + speed, 34, 136);
    ctx.restore();
  }

  function render(alpha) {
    var ctx = app.ctx, w = cfg.view.width, h = cfg.view.height;
    drawBackground(ctx, w, h);
    drawWalls(ctx, app.sim.world);
    PB.Plunger.draw(ctx, app.sim.plunger, LANE.x, LANE.w);
    if (app.sim.ball.active) PB.Ball.draw(ctx, app.sim.ball, alpha);
    drawHud(ctx, app.sim);
  }

  function update(dt) {
    updateStars(dt);
    var edges = app.input.consume();
    if (edges.reset) PB.sim.spawnBall(app.sim);
    PB.sim.step(app.sim, { plungerHeld: app.input.plungerHeld }, dt);
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
      // Draw one static frame plus the result so it is visible in a screenshot.
      render(0);
      app.ctx.fillStyle = res.det && res.tun ? cfg.theme.neonGreen : '#ff6b6b';
      app.ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
      app.ctx.textAlign = 'center';
      app.ctx.fillText(res.msg, cfg.view.width / 2, cfg.view.height / 2);
      return;
    }

    app.input = PB.input.create();
    var loop = PB.loop.create({
      hz: cfg.sim.hz,
      maxSubSteps: cfg.sim.maxSubSteps,
      update: update,
      render: render,
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
