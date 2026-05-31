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

    // Phase 1 sandbox.
    phase1Header: 'PHASE 1 - PHYSICS SANDBOX',
    plungerHint: 'HOLD SPACE to charge, release to launch',
    resetHint: 'R to reset the ball',
    drains: 'Drains',
    speed: 'Speed',
  };

})(window.PB = window.PB || {});
