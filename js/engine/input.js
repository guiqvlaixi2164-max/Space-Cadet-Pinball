// input.js - keyboard handling. Held states (flippers, plunger) are read once
// per fixed step; menu and one-shot actions are edge-triggered and consumed once
// so the simulation stays deterministic. Flipper and plunger bindings come from
// the saved settings (remappable); nudge, menu navigation, pause, and reset use
// fixed keys. A capture mode supports rebinding from the settings menu.

(function (PB) {
  'use strict';

  var DEFAULT_KM = {
    flipperLeft: 'ShiftLeft', flipperRight: 'ShiftRight', plunger: 'Space',
    nudgeLeft: 'ArrowLeft', nudgeRight: 'ArrowRight', nudgeUp: 'ArrowUp', pause: 'KeyP',
  };

  PB.input = {
    create: function (keymap) {
      var km = keymap || DEFAULT_KM;

      var state = {
        keymap: km,
        flipperLeft: false,
        flipperRight: false,
        plungerHeld: false,
        // Menu navigation edges (fixed keys) plus nudge edges (remappable). Nudge
        // is kept separate from menu left/right/up so the bindings are independent.
        _edges: { enter: false, escape: false, pause: false, reset: false,
                  up: false, down: false, left: false, right: false,
                  nudgeL: false, nudgeR: false, nudgeU: false },
        _capture: null,

        setKeymap: function (next) { this.keymap = next; },
        captureKey: function (cb) { this._capture = cb; },

        consume: function () {
          var e = this._edges;
          var out = { enter: e.enter, escape: e.escape, pause: e.pause, reset: e.reset,
                      up: e.up, down: e.down, left: e.left, right: e.right,
                      nudgeL: e.nudgeL, nudgeR: e.nudgeR, nudgeU: e.nudgeU };
          e.enter = e.escape = e.pause = e.reset = e.up = e.down = e.left = e.right = false;
          e.nudgeL = e.nudgeR = e.nudgeU = false;
          return out;
        },
      };

      // Keys we always swallow so the page does not scroll/act on them.
      var owned = {
        Space: 1, Enter: 1, Escape: 1,
        ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
      };

      function applyDown(code) {
        var km = state.keymap;
        var e = state._edges, hit = false;
        // Held controls (remappable, no hardcoded alternates).
        if (code === km.flipperLeft) { state.flipperLeft = true; hit = true; }
        if (code === km.flipperRight) { state.flipperRight = true; hit = true; }
        if (code === km.plunger) { state.plungerHeld = true; hit = true; }
        // Nudge edges (remappable).
        if (code === km.nudgeLeft) { e.nudgeL = true; hit = true; }
        if (code === km.nudgeRight) { e.nudgeR = true; hit = true; }
        if (code === km.nudgeUp) { e.nudgeU = true; hit = true; }
        if (code === km.pause) { e.pause = true; hit = true; }
        // Fixed menu navigation / confirm / back.
        switch (code) {
          case 'Enter': e.enter = true; hit = true; break;
          case 'Space': e.enter = true; hit = true; break; // also confirms in menus
          case 'Escape': e.escape = true; hit = true; break;
          case 'ArrowUp': e.up = true; hit = true; break;
          case 'ArrowDown': e.down = true; hit = true; break;
          case 'ArrowLeft': e.left = true; hit = true; break;
          case 'ArrowRight': e.right = true; hit = true; break;
        }
        return hit;
      }

      function applyUp(code) {
        var km = state.keymap;
        var hit = false;
        if (code === km.flipperLeft) { state.flipperLeft = false; hit = true; }
        if (code === km.flipperRight) { state.flipperRight = false; hit = true; }
        if (code === km.plunger) { state.plungerHeld = false; hit = true; }
        return hit;
      }

      window.addEventListener('keydown', function (ev) {
        // Rebind capture: swallow the next key and hand its code to the callback.
        if (state._capture) {
          ev.preventDefault();
          var cb = state._capture;
          state._capture = null;
          cb(ev.code === 'Escape' ? null : ev.code); // Escape cancels (null)
          return;
        }
        if (ev.repeat) { if (owned[ev.code]) ev.preventDefault(); return; }
        if (applyDown(ev.code) || owned[ev.code]) ev.preventDefault();
      });

      window.addEventListener('keyup', function (ev) {
        if (applyUp(ev.code)) ev.preventDefault();
      });

      window.addEventListener('blur', function () {
        state.flipperLeft = state.flipperRight = state.plungerHeld = false;
      });

      return state;
    },
  };

})(window.PB = window.PB || {});
