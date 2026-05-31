// input.js - keyboard handling. Phase 1 covers the plunger (hold Space to
// charge, release to launch) and a manual ball reset (R). Flippers, nudge, and
// remapping arrive in Phase 2. The loop reads this state once per fixed step,
// so a given sequence of key states yields a deterministic simulation.

(function (PB) {
  'use strict';

  PB.input = {
    create: function () {
      var state = {
        plungerHeld: false,
        resetQueued: false,   // one-shot; consume() clears it
        // consume edge-triggered actions so each fires exactly once
        consume: function () {
          var r = this.resetQueued;
          this.resetQueued = false;
          return { reset: r };
        },
      };

      // Codes we handle, so we can preventDefault (Space scrolls the page).
      var handled = { 'Space': true, 'KeyR': true };

      window.addEventListener('keydown', function (e) {
        if (e.repeat) { if (handled[e.code]) e.preventDefault(); return; }
        if (e.code === 'Space') { state.plungerHeld = true; e.preventDefault(); }
        else if (e.code === 'KeyR') { state.resetQueued = true; e.preventDefault(); }
      });

      window.addEventListener('keyup', function (e) {
        if (e.code === 'Space') { state.plungerHeld = false; e.preventDefault(); }
      });

      // Releasing focus should not leave the plunger stuck "held".
      window.addEventListener('blur', function () { state.plungerHeld = false; });

      return state;
    },
  };

})(window.PB = window.PB || {});
