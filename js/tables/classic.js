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

    // Standup targets. Three selectors across the top choose a mission; the
    // START gate on the left orbit begins the selected mission; the LOCK target
    // on the right banks balls toward multiball. role + id drive the mission
    // state machine in js/game/missions.js. [ax, ay] to [bx, by].
    standups: [
      { role: 'select', id: 0, name: 'WARP',   a: [150, 100], b: [178, 100] },
      { role: 'select', id: 1, name: 'TARGET', a: [286, 92],  b: [314, 92] },
      { role: 'select', id: 2, name: 'RESCUE', a: [422, 100], b: [450, 100] },
      { role: 'start',  id: 3, name: 'START',  a: [58, 196],  b: [58, 226] },
      { role: 'lock',   id: 4, name: 'LOCK',   a: [508, 196], b: [508, 226] },
    ],

    // Flippers. Angles in radians from +x (y down). Left presses by decreasing
    // its angle, right by increasing.
    flippers: {
      left:  { pivotX: 195, pivotY: 800, rest: 0.46, active: -0.52 },
      right: { pivotX: 365, pivotY: 800, rest: PI - 0.46, active: (PI - 0.46) + 0.98 },
    },

    // Innovation 2: the time-dilation zone, a circle of slowed time in mid
    // playfield. Charge it with bumper/slingshot hits; once full, rolling the
    // ball through it triggers slow motion.
    dilation: { x: 250, y: 470, r: 64 },

    // Innovation 1: how the table reconfigures. Each pop bumper has an Asteroid
    // Field position/size it morphs to (its Station home is its spawn above);
    // two deflector walls deploy in Asteroid mode, growing out from their
    // midpoint into the deployed segment below.
    transform: {
      // Asteroid positions are kept clear of the drop-target bank at x=472
      // (a bumper disc must not reach it, or the bank becomes unhittable).
      bumpers: [
        { alt: { x: 120, y: 235, r: 20 } },
        { alt: { x: 300, y: 160, r: 30 } },
        { alt: { x: 480, y: 235, r: 20 } },
      ],
      deflectors: [
        [206, 360, 150, 470],
        [394, 360, 450, 470],
      ],
    },
  };

})(window.PB = window.PB || {});
