// config.js - centralized tuning constants. Tune the game from this one file.
// Attaches to the global PB namespace (classic-script loading; see index.html).

(function (PB) {
  'use strict';

  var PI = Math.PI;

  PB.config = {
    // Fixed internal canvas resolution (CSS scales it to the viewport).
    view: {
      width: 600,
      height: 900,
    },

    // Simulation. Fixed timestep for deterministic, reproducible physics.
    sim: {
      hz: 120,                 // physics steps per second
      maxSubSteps: 8,          // clamp to avoid spiral-of-death after a stall
      seed: 1,                 // seed for the deterministic PRNG
    },

    // Physics tuning. Units: pixels, seconds.
    physics: {
      gravity: 1600,           // downward acceleration (px/s^2)
      ballRadius: 9,
      restitution: 0.42,       // default wall bounciness (0 dead, 1 perfect)
      friction: 0.04,          // tangential velocity loss per bounce
      restThreshold: 7,        // normal speed below which a bounce is killed (px/s)
      skin: 0.05,              // tiny separation pushed out after a contact (px)
      maxMoveIters: 8,         // CCD resolution passes per body per step
      maxSpeed: 2600,          // clamp to keep the ball stable (px/s)
      drainY: 912,             // ball center past this y counts as drained
    },

    // Plunger (hold to charge, release to launch).
    plunger: {
      minLaunch: 950,
      maxLaunch: 1950,
      chargeSeconds: 1.0,
      laneXMin: 538,
      laneYMin: 700,
      launchSpeedMax: 60,
      restY: 870,
      maxPull: 26,
    },

    // Flippers. Angles are radians measured from the +x axis (canvas y is down).
    // The left flipper presses by decreasing its angle; the right by increasing.
    flippers: {
      length: 80,
      thickness: 13,           // visual/collision half handled via cap radius
      flipSpeed: 26,           // angular slew toward target (rad/s)
      restitution: 0.5,
      left:  { pivotX: 195, pivotY: 800, rest:  0.46, active: -0.52 },
      right: { pivotX: 365, pivotY: 800, rest: PI - 0.46, active: (PI - 0.46) + 0.98 },
    },

    // Pop bumpers (circular). kick is the extra outward impulse on contact.
    bumpers: {
      restitution: 0.42,
      kick: 420,
      litSeconds: 0.18,
      list: [
        { x: 160, y: 235, r: 24 },
        { x: 300, y: 195, r: 24 },
        { x: 440, y: 235, r: 24 },
      ],
    },

    // Slingshots: bouncy angled walls just above and inside each flipper.
    slingshots: {
      restitution: 0.75,
      kick: 260,
      litSeconds: 0.14,
    },

    // Drop targets: a vertical bank the ball knocks down for points.
    dropTargets: {
      resetSeconds: 2.5,       // bank pops back up this long after the last drop
      x: 472,
      ys: [300, 332, 364, 396],
      height: 26,
    },

    // Tilt and nudge.
    tilt: {
      nudgeImpulse: 150,       // velocity added to the ball per nudge (px/s)
      nudgeBob: 0.34,          // tilt-bob added per nudge
      bobDecay: 1.6,           // tilt-bob recovered per second
      warnAt: 0.6,             // show the danger warning above this
      tiltAt: 1.0,             // lock the table out at this
    },

    // Score values (a full scoring/rank system arrives in Phase 3).
    score: {
      bumper: 100,
      slingshot: 20,
      dropTarget: 500,
      dropBank: 2000,
    },

    // Starfield background.
    starfield: {
      layers: [
        { count: 60,  speed: 6,  size: 1.0, color: 'rgba(180,210,255,0.55)' },
        { count: 40,  speed: 14, size: 1.6, color: 'rgba(120,170,255,0.75)' },
        { count: 18,  speed: 28, size: 2.4, color: 'rgba(120,230,255,0.95)' },
      ],
    },

    // Visual theme.
    theme: {
      neonCyan: '#36e3ff',
      neonMagenta: '#ff4fd8',
      neonAmber: '#ffc24b',
      neonGreen: '#7CFFB2',
      neonRed: '#ff6b6b',
      wall: '#5870c8',
      text: '#dff1ff',
    },

    // Build metadata.
    version: '0.2.0',
    phase: 2,
  };

})(window.PB = window.PB || {});
