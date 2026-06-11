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
      sweepSubsteps: 4,   // intermediate angles tested to avoid pass-through
    },

    // Bumper / slingshot tuning (positions are in the table data).
    bumpers: { restitution: 0.42, kick: 420, litSeconds: 0.18 },
    slingshots: { restitution: 0.75, kick: 260, litSeconds: 0.14 },
    dropTargets: { resetSeconds: 2.5 },

    // Standup targets (mission select / start / multiball lock). Positions are
    // in the table data; this is their physics + debounce.
    standups: { restitution: 0.5, kick: 60, litSeconds: 0.2, cooldown: 0.3 },

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
      standup: 250,
    },

    // Game rules.
    game: {
      balls: 3,
      ballSaveSeconds: 6,
      multiplierCap: 5,
      messageSeconds: 1.8,
      maxHighScores: 10,
    },

    // Missions and multiball. Jackpots are awarded raw (no multiplier). The
    // three v1 missions: Warp Survey (hit bumpers), Target Lock (clear the drop
    // bank), Rescue (hit the rescue target). Multiball locks via the lock target.
    missions: {
      lockNeed: 3,                 // lock hits to start multiball
      warp:   { need: 8, time: 25, jackpot: 25000 },
      bank:   { need: 1, time: 30, jackpot: 30000 },
      rescue: { need: 3, time: 20, jackpot: 20000 },
      // Fixed spawn states for the two extra multiball balls (deterministic).
      mbSpawns: [
        { x: 250, y: 430, vx: -120, vy: -210 },
        { x: 350, y: 430, vx:  120, vy: -210 },
      ],
    },

    // Innovation 1: Dynamic Table Transformation. Seconds for a full morph
    // between Station and Asteroid Field layouts (bumpers relocate, deflectors
    // deploy). The geometry of each mode lives in the table data.
    transform: { duration: 1.3 },

    // Innovation 2: Time Dilation Zone. The zone geometry is in the table data;
    // this is its tuning. slowScale is the per-ball time scale inside an active
    // zone; the meter charges from bumper/slingshot hits and drains while active.
    dilation: {
      slowScale: 0.34,
      chargePerBumper: 0.16,
      chargePerSling: 0.08,
      drainPerSecond: 0.4,
      rippleSpeed: 3.2,
      edgeBand: 0.4,        // fraction of the radius over which the scale eases
      maxActiveSeconds: 6,  // hard cap so one activation cannot last forever
    },

    // Audio. master is the ceiling under the user volume; the music/sfx levels
    // balance the two buses; bpm sets the music tempo; layerFade is the seconds
    // a music layer takes to ramp in or out when the intensity changes.
    audio: {
      master: 0.9,
      musicLevel: 0.5,
      sfxLevel: 0.9,
      bpm: 132,
      layerFade: 0.8,
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

    version: '1.0.0',
    phase: 7,
  };

  // Color palettes. cfg.theme above is the live (active) palette; applyPalette
  // copies one of these into it in place, so every draw call that reads
  // cfg.theme picks up the change with no other plumbing. The colorblind palette
  // is deuteranopia-friendly: it shifts the green and red roles (the classic
  // confusable pair) to blue and orange while keeping cyan, amber, and magenta.
  PB.palettes = {
    default: {
      neonCyan: '#36e3ff', neonMagenta: '#ff4fd8', neonAmber: '#ffc24b',
      neonGreen: '#7CFFB2', neonRed: '#ff6b6b',
      wall: '#5870c8', text: '#dff1ff', dim: 'rgba(8,12,28,0.72)',
    },
    // Based on the Okabe-Ito colorblind-safe categorical palette, which is
    // designed to stay distinguishable under deuteranopia, protanopia, and
    // tritanopia. Each game role maps to a distinct Okabe-Ito hue: sky blue,
    // reddish purple, orange, bluish green, and vermillion.
    colorblind: {
      neonCyan: '#56B4E9', neonMagenta: '#CC79A7', neonAmber: '#E69F00',
      neonGreen: '#009E73', neonRed: '#D55E00',
      wall: '#7f8fd6', text: '#dff1ff', dim: 'rgba(8,12,28,0.72)',
    },
  };

  PB.applyPalette = function (colorblind) {
    var p = colorblind ? PB.palettes.colorblind : PB.palettes.default;
    var t = PB.config.theme;
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) t[k] = p[k];
  };

})(window.PB = window.PB || {});
