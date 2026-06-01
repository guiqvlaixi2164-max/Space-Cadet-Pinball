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
  // stream on every machine, keeping any randomized gameplay reproducible.
  PB.makeRNG = function (seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

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
      rng: PB.makeRNG(PB.config.sim.seed),
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

})(window.PB = window.PB || {});
