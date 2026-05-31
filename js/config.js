// config.js - centralized tuning constants. Tune the game from this one file.
// Geometry/positions live in the table data (js/tables/*.js); this file holds
// physics and gameplay tuning. Attaches to the global PB namespace.

(function (PB) {
  'use strict';

  PB.config = {
    view: { width: 600, height: 900 },

    sim: { hz: 120, maxSubSteps: 8, seed: 1 },

    physics: {
      gravity: 1600,
      ballRadius: 9,
      restitution: 0.42,
      friction: 0.04,
      restThreshold: 7,
      skin: 0.05,
      maxMoveIters: 8,
      maxSpeed: 2600,
      drainY: 912,
    },

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

    // Flipper tuning (pivots and angles are in the table data).
    flippers: {
      length: 80,
      thickness: 13,
      flipSpeed: 26,
      restitution: 0.5,
    },

    // Bumper / slingshot tuning (positions are in the table data).
    bumpers: { restitution: 0.42, kick: 420, litSeconds: 0.18 },
    slingshots: { restitution: 0.75, kick: 260, litSeconds: 0.14 },
    dropTargets: { resetSeconds: 2.5 },

    tilt: {
      nudgeImpulse: 150,
      nudgeBob: 0.34,
      bobDecay: 1.6,
      warnAt: 0.6,
      tiltAt: 1.0,
    },

    // Scoring values (base points; the multiplier is applied on top).
    score: {
      bumper: 100,
      slingshot: 20,
      dropTarget: 500,
      dropBank: 2000,
    },

    // Game rules.
    game: {
      balls: 3,
      ballSaveSeconds: 6,
      multiplierCap: 5,
      messageSeconds: 1.8,
      maxHighScores: 10,
    },

    starfield: {
      layers: [
        { count: 60,  speed: 6,  size: 1.0, color: 'rgba(180,210,255,0.55)' },
        { count: 40,  speed: 14, size: 1.6, color: 'rgba(120,170,255,0.75)' },
        { count: 18,  speed: 28, size: 2.4, color: 'rgba(120,230,255,0.95)' },
      ],
    },

    theme: {
      neonCyan: '#36e3ff',
      neonMagenta: '#ff4fd8',
      neonAmber: '#ffc24b',
      neonGreen: '#7CFFB2',
      neonRed: '#ff6b6b',
      wall: '#5870c8',
      text: '#dff1ff',
      dim: 'rgba(8,12,28,0.72)',
    },

    version: '0.3.0',
    phase: 3,
  };

})(window.PB = window.PB || {});
