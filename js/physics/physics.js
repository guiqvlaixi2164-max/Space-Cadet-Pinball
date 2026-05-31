// physics.js - vector math, a seeded PRNG, and the per-step integrator.
// The integrator is pure with respect to a "world" object: given the same world
// and the same dt sequence it always produces the same result (determinism).
// Collision response lives in collision.js (PB.collision.moveBody).

(function (PB) {
  'use strict';

  // Vector helpers. Vectors are plain {x, y} objects.
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
    // Left-hand perpendicular.
    perp: function (a) { return { x: -a.y, y: a.x }; },
  };
  PB.V = V;

  // mulberry32: a small, fast, deterministic PRNG. Same seed gives same stream
  // on every machine, which keeps any randomized gameplay reproducible.
  PB.makeRNG = function (seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Construct an empty physics world. Game code adds bodies and segments.
  PB.makeWorld = function () {
    var p = PB.config.physics;
    return {
      gravity: p.gravity,
      restitution: p.restitution,
      friction: p.friction,
      restThreshold: p.restThreshold,
      skin: p.skin,
      maxMoveIters: p.maxMoveIters,
      bodies: [],
      segments: [],
      rng: PB.makeRNG(PB.config.sim.seed),
    };
  };

  // A dynamic circular body (the ball).
  PB.makeBall = function (x, y, radius) {
    return {
      pos: { x: x, y: y },
      prev: { x: x, y: y },   // previous-step position for render interpolation
      vel: { x: 0, y: 0 },
      radius: radius,
      active: true,
    };
  };

  // A static collision segment from a to b. Optional per-segment material.
  PB.makeSegment = function (ax, ay, bx, by, opts) {
    opts = opts || {};
    return {
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      restitution: opts.restitution,
      friction: opts.friction,
    };
  };

  // Advance the world by one fixed step: apply gravity, then resolve motion with
  // continuous collision detection for every active dynamic body.
  PB.step = function (world, dt) {
    var bodies = world.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.active) continue;
      b.prev.x = b.pos.x;
      b.prev.y = b.pos.y;
      b.vel.y += world.gravity * dt;
      PB.collision.moveBody(world, b, dt);
    }
  };

})(window.PB = window.PB || {});
