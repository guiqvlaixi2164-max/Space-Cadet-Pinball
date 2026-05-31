// strings.js - all user-facing text in one place to ease future localization.
// No long-dash characters anywhere (project constraint): use a hyphen.

(function (PB) {
  'use strict';

  PB.strings = {
    title: 'SPACE CADET',
    subtitle: 'Deluxe Edition',
    hello: 'Hello, Cadet',
    pressToStart: 'Press SPACE to launch',
    booting: 'Systems online',

    // Phase 2 sandbox.
    phase2Header: 'PHASE 2 - FLIPPERS AND PLAYFIELD',
    controlsFlippers: 'SHIFT (or Z / slash): flippers',
    controlsPlunger: 'SPACE or DOWN: plunger',
    controlsNudge: 'ARROWS: nudge',
    controlsReset: 'R: reset ball',
    score: 'Score',
    drains: 'Drains',
    tiltWarn: 'CAREFUL',
    tilted: 'TILT',
  };

})(window.PB = window.PB || {});
