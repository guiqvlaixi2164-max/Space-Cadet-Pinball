// classic.js - the v1 table definition as a plain JS data object (not fetched
// JSON, to sidestep the file:// fetch block). js/game/table.js turns this into
// physics bodies. Positions are in canvas pixels (600 x 900, y down). Physics
// and scoring tuning for these elements lives in js/config.js.

(function (PB) {
  'use strict';

  var PI = Math.PI;

  PB.TABLES = PB.TABLES || {};
  PB.TABLES.classic = {
    name: 'Classic Station',

    spawn: { x: 552, y: 853 },   // ball rest position in the plunger lane
    lane: { x: 538, w: 28 },     // plunger lane bounds (for drawing)

    // Static walls: [ax, ay, bx, by].
    walls: [
      [24, 120, 24, 740],        // left wall
      [120, 24, 470, 24],        // top wall
      [566, 120, 566, 862],      // right outer wall (also lane outer)
      [538, 300, 538, 862],      // lane divider (open above y=300)
      [538, 862, 566, 862],      // lane floor (ball rests here)
      [24, 740, 150, 805],       // left lower wall
      [538, 560, 410, 805],      // right lower wall
    ],

    // Curved guides approximated as arcs: round the top corners into an orbit.
    arcs: [
      { cx: 120, cy: 120, r: 96, a0: PI,        a1: PI * 1.5, steps: 6 },
      { cx: 470, cy: 120, r: 96, a0: PI * 1.5,  a1: PI * 2,   steps: 6 },
    ],

    // Bouncy scoring walls just above and inside each flipper.
    slingshots: [
      [150, 805, 196, 745],
      [410, 805, 364, 745],
    ],

    // Pop bumpers: { x, y, r }.
    bumpers: [
      { x: 160, y: 235, r: 24 },
      { x: 300, y: 195, r: 24 },
      { x: 440, y: 235, r: 24 },
    ],

    // Vertical drop-target bank.
    dropTargets: { x: 472, ys: [300, 332, 364, 396], height: 26 },

    // Flippers. Angles in radians from +x (y down). Left presses by decreasing
    // its angle, right by increasing.
    flippers: {
      left:  { pivotX: 195, pivotY: 800, rest: 0.46, active: -0.52 },
      right: { pivotX: 365, pivotY: 800, rest: PI - 0.46, active: (PI - 0.46) + 0.98 },
    },
  };

})(window.PB = window.PB || {});
