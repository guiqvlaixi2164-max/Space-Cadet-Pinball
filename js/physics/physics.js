// physics.js - vector math, a seeded PRNG, and the per-step integrator.
// The integrator is pure with respect to a "world" object: given the same world
// and the same dt sequence it always produces the same result (determinism).
// Collision response lives in collision.js (PB.collision.moveBody).

(function (PB) {
  'use strict';

  var V = {
    add: function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
    sub: function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
    scale: function (a, s) { return { x: a.x * s, y: a.y * s }; },
    dot: function (a, b) { return a.x * b.x + a.y * b.y; },
    len2: function (a) { return a.x * a.x + a.y * a.y; },
    len: function (a) { return Math.sqrt(a.x * a.x + a.y * a.y); },
    norm: function (a) {
      var l = Math.sqrt(a.x * a.x + a.y * a.y) || 1;
      return { x: a.x / l, y: a.y / l };
    },
    perp: function (a) { return { x: -a.y, y: a.x }; },
  };
  PB.V = V;

  // mulberry32: a small, fast, deterministic PRNG. Same seed gives the same
  // stream on every machine. Reserved for future randomized gameplay (none yet),
  // and intentionally NOT wired into the world, so nothing implies reproducible
  // randomness that does not exist. Add randomness through this (seeded from
  // config.sim.seed) if you want it to stay replay-safe.
  PB.makeRNG = function (seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Deterministic sine/cosine. Math.sin/cos are NOT specified to be correctly
  // rounded, so they can differ in the last bit between JS engines and OS math
  // libraries; feeding those into the flipper geometry every step makes the
  // simulation diverge across machines over time. These use only range reduction
  // (Math.floor, Math.PI) and +,-,*,/ which ARE IEEE-754 deterministic, plus a
  // 13th-order Taylor series (error < 1e-5 over the reduced range), so the sim is
  // bit-reproducible on any conformant engine. Used by the flipper and arc math.
  var PI = Math.PI, TWO_PI = 2 * Math.PI;
  PB.dsin = function (x) {
    x = x - TWO_PI * Math.floor((x + PI) / TWO_PI);   // reduce to [-PI, PI)
    var x2 = x * x;
    return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 +
      x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
  };
  PB.dcos = function (x) { return PB.dsin(x + PI / 2); };

  PB.makeWorld = function () {
    var p = PB.config.physics;
    return {
      gravity: p.gravity,
      restitution: p.restitution,
      friction: p.friction,
      restThreshold: p.restThreshold,
      skin: p.skin,
      maxMoveIters: p.maxMoveIters,
      maxSpeed: p.maxSpeed,
      bodies: [],
      segments: [],   // static line segments (walls, slingshots, drop targets)
      flippers: [],    // rotating flipper segments (moving surfaces)
      circles: [],     // circular obstacles (pop bumpers)
    };
  };

  PB.makeBall = function (x, y, radius) {
    return {
      pos: { x: x, y: y },
      prev: { x: x, y: y },
      vel: { x: 0, y: 0 },
      radius: radius,
      active: true,
      contacts: [],
      dtScale: 1,      // per-ball time scale (Innovation 2: time dilation)
    };
  };

  PB.makeSegment = function (ax, ay, bx, by, opts) {
    opts = opts || {};
    return {
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      restitution: opts.restitution,
      friction: opts.friction,
      kick: opts.kick || 0,
      kind: opts.kind || 'wall',
      score: opts.score || 0,
      active: opts.active !== false,
      lit: 0,
    };
  };

  // Advance the world by one fixed step: apply gravity, then resolve motion with
  // continuous collision detection for every active dynamic body. Each body may
  // carry a dtScale (1 by default); a ball inside an active time-dilation zone
  // gets a fraction here, so it integrates in slowed time while the rest of the
  // world runs at full speed. Scaling time (not velocity) keeps energy intact.
  PB.step = function (world, dt) {
    var bodies = world.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.active) continue;
      var bdt = b.dtScale ? dt * b.dtScale : dt;
      b.prev.x = b.pos.x;
      b.prev.y = b.pos.y;
      b.vel.y += world.gravity * bdt;
      PB.collision.moveBody(world, b, bdt);
    }
  };

  // Resolve ball-against-ball overlaps after integration (multiball). Equal-mass
  // circles: push the pair apart equally and exchange the normal component of
  // their relative velocity. Deterministic (pure function of the bodies), so it
  // does not disturb reproducibility. Run after PB.step.
  PB.resolveBallPairs = function (world) {
    var b = world.bodies, n = b.length, i, j;
    for (i = 0; i < n; i++) {
      var bi = b[i];
      if (!bi.active) continue;
      for (j = i + 1; j < n; j++) {
        var bj = b[j];
        if (!bj.active) continue;
        var dx = bj.pos.x - bi.pos.x, dy = bj.pos.y - bi.pos.y;
        var rr = bi.radius + bj.radius;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-9) continue;
        var d = Math.sqrt(d2);
        var nx = dx / d, ny = dy / d;
        var push = (rr - d) * 0.5;
        bi.pos.x -= nx * push; bi.pos.y -= ny * push;
        bj.pos.x += nx * push; bj.pos.y += ny * push;
        var rvx = bj.vel.x - bi.vel.x, rvy = bj.vel.y - bi.vel.y;
        var vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          var imp = -(1 + world.restitution) * vn * 0.5;
          bi.vel.x -= imp * nx; bi.vel.y -= imp * ny;
          bj.vel.x += imp * nx; bj.vel.y += imp * ny;
        }
      }
    }
  };

})(window.PB = window.PB || {});
