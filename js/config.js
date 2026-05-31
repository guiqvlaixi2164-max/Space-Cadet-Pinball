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
    },

    // Physics tuning (filled in starting Phase 1). Units: pixels, seconds.
    physics: {
      gravity: 2000,           // downward acceleration (px/s^2), placeholder
      ballRadius: 9,
      restitution: 0.45,       // default wall bounciness
      friction: 0.02,
    },

    // Starfield background (used from Phase 0).
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
      text: '#dff1ff',
    },

    // Build metadata.
    version: '0.0.0',
    phase: 0,
  };

})(window.PB = window.PB || {});
