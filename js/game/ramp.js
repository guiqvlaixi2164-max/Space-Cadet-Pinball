// ramp.js - helpers for guided lanes and curved guides. In a top-down 2D table,
// a ramp or orbit is a smooth wall that routes the ball; we approximate curves
// with short chained segments so the existing collision solver handles them.

(function (PB) {
  'use strict';

  PB.Ramp = {
    // Return an array of segments approximating an arc centered at (cx, cy) from
    // angle a0 to a1 (radians), with the given radius and number of steps.
    arc: function (cx, cy, radius, a0, a1, steps, opts) {
      var segs = [];
      // Deterministic trig so the generated wall geometry is identical across
      // engines (these walls are static, but ULP differences would still shift
      // collisions and break cross-machine reproducibility).
      var prevx = cx + radius * PB.dcos(a0);
      var prevy = cy + radius * PB.dsin(a0);
      for (var i = 1; i <= steps; i++) {
        var t = a0 + (a1 - a0) * (i / steps);
        var x = cx + radius * PB.dcos(t);
        var y = cy + radius * PB.dsin(t);
        segs.push(PB.makeSegment(prevx, prevy, x, y, opts));
        prevx = x; prevy = y;
      }
      return segs;
    },
    // Note: a previous straight-channel "lane" helper was removed as dead code
    // (it was never called). Adding real routed ramps/habitrails is a content
    // task for a later table revision and needs hands-on playtesting to tune.
  };

})(window.PB = window.PB || {});
