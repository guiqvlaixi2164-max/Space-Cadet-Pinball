// config.js - centralized tuning constants. Tune the game from this one file.
// Attaches to the global PB namespace (classic-script loading; see index.html).

(function (PB) {
  'use strict';

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
      drainY: 912,             // ball center past this y counts as drained
    },

    // Plunger (hold to charge, release to launch).
    plunger: {
      minLaunch: 950,          // launch speed at zero charge (px/s)
      maxLaunch: 1950,         // launch speed at full charge (px/s)
      chargeSeconds: 1.0,      // hold time to reach full charge
      laneXMin: 538,           // ball is "in the lane" when x is past this
      laneYMin: 700,           // and y is past this
      launchSpeedMax: 60,      // ball must be near-resting to launch (px/s)
      restY: 870,              // plunger head rest position (visual)
      maxPull: 26,             // how far the head pulls down at full charge (visual)
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
      wall: '#5870c8',
      text: '#dff1ff',
    },

    // Build metadata.
    version: '0.1.0',
    phase: 1,
  };

})(window.PB = window.PB || {});
