// input.js - keyboard handling. Phase 2 adds the two flippers and nudge/tilt on
// top of the Phase 1 plunger and reset. Held states (flippers, plunger) are read
// once per fixed step; nudges and reset are edge-triggered and consumed once, so
// a given key sequence yields a deterministic simulation. Full remapping arrives
// with the settings menu in Phase 3.

(function (PB) {
  'use strict';

  PB.input = {
    create: function () {
      var state = {
        flipperLeft: false,
        flipperRight: false,
        plungerHeld: false,
        nudgeLQ: false,
        nudgeRQ: false,
        nudgeUQ: false,
        resetQ: false,
        consume: function () {
          var out = {
            reset: this.resetQ,
            nudgeL: this.nudgeLQ,
            nudgeR: this.nudgeRQ,
            nudgeU: this.nudgeUQ,
          };
          this.resetQ = this.nudgeLQ = this.nudgeRQ = this.nudgeUQ = false;
          return out;
        },
      };

      // Default bindings. Flippers: Shift keys (with Z and / as alternates).
      // Plunger: Space or Down. Nudge: arrows. Reset: R.
      function down(code) {
        switch (code) {
          case 'ShiftLeft': case 'KeyZ': state.flipperLeft = true; return true;
          case 'ShiftRight': case 'Slash': state.flipperRight = true; return true;
          case 'Space': case 'ArrowDown': state.plungerHeld = true; return true;
          case 'ArrowLeft': state.nudgeLQ = true; return true;
          case 'ArrowRight': state.nudgeRQ = true; return true;
          case 'ArrowUp': state.nudgeUQ = true; return true;
          case 'KeyR': state.resetQ = true; return true;
        }
        return false;
      }

      function up(code) {
        switch (code) {
          case 'ShiftLeft': case 'KeyZ': state.flipperLeft = false; return true;
          case 'ShiftRight': case 'Slash': state.flipperRight = false; return true;
          case 'Space': case 'ArrowDown': state.plungerHeld = false; return true;
        }
        return false;
      }

      var owned = {
        ShiftLeft: 1, ShiftRight: 1, KeyZ: 1, Slash: 1, Space: 1, ArrowDown: 1,
        ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, KeyR: 1,
      };

      window.addEventListener('keydown', function (e) {
        // Repeats must not re-trigger edge actions, but should still block the
        // default (Space/arrows scroll the page).
        if (e.repeat) { if (owned[e.code]) e.preventDefault(); return; }
        if (down(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) {
        if (up(e.code)) e.preventDefault();
      });
      window.addEventListener('blur', function () {
        state.flipperLeft = state.flipperRight = state.plungerHeld = false;
      });

      return state;
    },
  };

})(window.PB = window.PB || {});
